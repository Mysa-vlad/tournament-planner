import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { logger } from '../shared/index.js';
import type { Database } from './database.js';
import { sql } from './sql.js';

const MIGRATIONS_DIR = join(import.meta.dirname, '..', '..', 'migrations');

/** Прості послідовні міграції: migrations/NNN_*.sql, кожна — в окремій транзакції. */
export const migrate = async (db: Database): Promise<void> => {
  await db.query(sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
  const applied = new Set(
    (await db.query<{ name: string }>(sql`SELECT name FROM schema_migrations`)).map((r) => r.name),
  );
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();

  for (const name of files) {
    if (applied.has(name)) continue;
    const text = await readFile(join(MIGRATIONS_DIR, name), 'utf8');
    await db.transaction(async () => {
      await db.exec(text);
      await db.query(sql`INSERT INTO schema_migrations (name) VALUES (${name})`);
    });
    logger.info({ migration: name }, 'migration applied');
  }
};
