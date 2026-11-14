import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { logger } from '../shared/index.js';
import type { Database } from './contract.js';
import { sql } from './sql.js';

const MIGRATIONS_DIR = join(import.meta.dirname, '..', '..', 'migrations');

/**
 * spec-lab4 §4: міграції — окремі кроки з різною природою.
 * - schema:  блокуючі DDL, сумісні назад; кожна у своїй транзакції
 * - data:    неблокуючі оновлення даних пачками; кожна у своїй транзакції
 * - indexes: CREATE INDEX CONCURRENTLY — НЕ можна в транзакції
 */
export const MIGRATION_STEPS = ['schema', 'data', 'indexes'] as const;
export type MigrationStep = (typeof MIGRATION_STEPS)[number];

/** до завдання 4 міграції лежали в корені migrations/ — та сама міграція під новою назвою */
const LEGACY_NAMES: Record<string, string> = { '001_init.sql': 'schema/001_init.sql' };

const listFiles = async (step: MigrationStep): Promise<string[]> => {
  const files = await readdir(join(MIGRATIONS_DIR, step)).catch(() => []);
  return files
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => `${step}/${f}`);
};

const ensureTable = (db: Database): Promise<unknown> =>
  db.query(sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);

const appliedNames = async (db: Database): Promise<Set<string>> => {
  const rows = await db.query<{ name: string }>(sql`SELECT name FROM schema_migrations`);
  return new Set(rows.map((r) => LEGACY_NAMES[r.name] ?? r.name));
};

export const migrate = async (
  db: Database,
  steps: readonly MigrationStep[] = MIGRATION_STEPS,
): Promise<string[]> => {
  await ensureTable(db);
  const applied = await appliedNames(db);
  const done: string[] = [];

  for (const step of steps) {
    for (const name of await listFiles(step)) {
      if (applied.has(name)) continue;
      const text = await readFile(join(MIGRATIONS_DIR, name), 'utf8');
      const record = sql`INSERT INTO schema_migrations (name) VALUES (${name})`;
      if (step === 'indexes') {
        await db.exec(text); // CONCURRENTLY: поза транзакцією; IF NOT EXISTS — безпечний повтор
        await db.query(record);
      } else {
        await db.transaction(async () => {
          await db.exec(text);
          await db.query(record);
        });
      }
      logger.info({ migration: name }, 'migration applied');
      done.push(name);
    }
  }
  return done;
};

export interface SchemaStatus {
  readonly expected: string | undefined;
  readonly applied: string | undefined;
  readonly upToDate: boolean;
}

/**
 * Для readiness (AC20): чи застосовано всі міграції структури, які знає ЦЯ версія коду.
 * Дані й індекси не блокують готовність — без них застосунок коректний, лише повільніший.
 */
export const schemaStatus = async (db: Database): Promise<SchemaStatus> => {
  const expected = (await listFiles('schema')).at(-1);
  // readiness лише читає: таблицю не створюємо, якщо її ще немає
  const [table] = await db.query<{ exists: boolean }>(
    sql`SELECT to_regclass('public.schema_migrations') IS NOT NULL AS exists`,
  );
  const applied = table?.exists
    ? [...(await appliedNames(db))]
        .filter((n) => n.startsWith('schema/'))
        .sort()
        .at(-1)
    : undefined;
  // новіша схема за очікувану — теж готовність: стара версія коду працює з expand-міграціями
  const upToDate = expected === undefined || (applied !== undefined && applied >= expected);
  return { expected, applied, upToDate };
};
