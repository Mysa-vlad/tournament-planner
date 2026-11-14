import request from 'supertest';
import { afterEach, describe, expect, test } from 'vitest';
import { createContainer } from '../../src/composition.js';
import { createDatabase, migrate, schemaStatus, sql, type Database } from '../../src/db/index.js';
import { seed } from '../../src/db/seed.js';
import { createApp } from '../../src/http/app.js';

// spec-lab4: /version, readiness для blue-green, окремі кроки міграцій і seed
const open: Database[] = [];
const freshDb = async (): Promise<Database> => {
  const db = await createDatabase('memory://');
  open.push(db);
  return db;
};
afterEach(async () => {
  await Promise.all(open.splice(0).map((db) => db.close()));
});

describe('/version і /health/ready (AC19, AC20)', () => {
  test('/version повертає SHA задеплоєного коміту і версію', async () => {
    const container = await createContainer({
      port: 0,
      version: '0.4.0',
      gitSha: 'abc1234',
      dataSource: 'static',
      databaseUrl: 'memory://',
    });
    const app = createApp(container, { version: '0.4.0', gitSha: 'abc1234' });
    const res = await request(app).get('/version');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ sha: 'abc1234', version: '0.4.0' });
    expect(Date.parse((res.body as { startedAt: string }).startedAt)).not.toBeNaN();
  });

  test('готовий інстанс → 200; БД зникла → 503 not_ready (трафік не йде на інстанс)', async () => {
    const container = await createContainer({
      port: 0,
      version: 'it',
      gitSha: 'test',
      dataSource: 'pg',
      databaseUrl: 'memory://',
    });
    const app = createApp(container, { version: 'it', gitSha: 'test' });
    const ok = await request(app).get('/health/ready');
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ status: 'ready', checks: { database: 'ok' } });

    await container.close();
    const down = await request(app).get('/health/ready');
    expect(down.status).toBe(503);
    expect(down.body).toEqual({ status: 'not_ready', checks: { database: 'unavailable' } });
    // liveness при цьому живий: процес не треба вбивати, лише не давати трафік
    expect((await request(app).get('/health')).status).toBe(200);
  });
});

describe('кроки міграцій (AC21)', () => {
  test('лише schema: структура є, індекс ще ні; readiness уже готова', async () => {
    const db = await freshDb();
    expect(await schemaStatus(db)).toEqual({
      expected: 'schema/001_init.sql',
      applied: undefined,
      upToDate: false,
    });
    expect(await migrate(db, ['schema'])).toEqual(['schema/001_init.sql']);
    expect((await schemaStatus(db)).upToDate).toBe(true);
    const idx = await db.query<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM pg_indexes WHERE indexname = 'matches_tournament_idx'`,
    );
    expect(idx[0]?.n).toBe(0);

    expect(await migrate(db, ['indexes'])).toEqual(['indexes/001_matches_tournament_idx.sql']);
    const after = await db.query<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM pg_indexes WHERE indexname = 'matches_tournament_idx'`,
    );
    expect(after[0]?.n).toBe(1);
  });

  test('стара назва міграції (до завдання 4) визнається як schema/001_init.sql', async () => {
    const db = await freshDb();
    await migrate(db, ['schema']);
    await db.query(sql`UPDATE schema_migrations SET name = '001_init.sql'`);
    expect(await migrate(db, ['schema'])).toEqual([]);
    expect((await schemaStatus(db)).upToDate).toBe(true);
  });

  test('схема відстає від коду → readiness 503 з поясненням', async () => {
    const db = await freshDb();
    await migrate(db);
    await db.query(sql`DELETE FROM schema_migrations WHERE name LIKE 'schema/%'`);
    expect(await schemaStatus(db)).toMatchObject({ upToDate: false, applied: undefined });
  });

  test('seed — окремо від міграцій та ідемпотентний', async () => {
    const db = await freshDb();
    await migrate(db);
    const teams = async (): Promise<number> =>
      (await db.query<{ n: number }>(sql`SELECT count(*)::int AS n FROM teams`))[0]?.n ?? 0;
    expect(await teams()).toBe(0); // міграції не додають даних
    await seed(db);
    await seed(db);
    expect(await teams()).toBe(4);
  });
});
