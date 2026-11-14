import { AsyncLocalStorage } from 'node:async_hooks';
import { mkdirSync } from 'node:fs';
import { PGlite, type Transaction } from '@electric-sql/pglite';
import { countQuery, logger } from '../shared/index.js';
import { translateDbError } from './errors.js';
import { createPostgresDatabase } from './postgres.js';
import { describeUrl, isPostgresUrl, type Database } from './contract.js';
import type { SqlQuery } from './sql.js';

type Executor = Pick<PGlite, 'query' | 'exec'> | Pick<Transaction, 'query' | 'exec'>;

export { describeUrl, isPostgresUrl, type Database } from './contract.js';

/** PostgreSQL-сервер (pg.Pool) для postgres://, інакше вбудований PGlite (memory:// або каталог). */
export const createDatabase = async (url: string): Promise<Database> =>
  isPostgresUrl(url) ? createPostgresDatabase(url) : createPgliteDatabase(url);

const createPgliteDatabase = async (url: string): Promise<Database> => {
  // файловий режим: PGlite не створює батьківський каталог сам
  if (!url.includes('://')) mkdirSync(url, { recursive: true });
  const pg = new PGlite(url);
  const activeTx = new AsyncLocalStorage<Transaction>();
  let closing: Promise<void> | undefined;

  const run = async <Row>(executor: Executor, query: SqlQuery): Promise<Row[]> => {
    countQuery();
    const startedAt = performance.now();
    try {
      const result = await executor.query<Row>(query.text, [...query.values]);
      // AC10: лог шару БД теж містить requestId/userId (mixin логера)
      logger.debug({ sql: query.text, ms: Math.round(performance.now() - startedAt) }, 'db query');
      return result.rows;
    } catch (err) {
      throw translateDbError(err);
    }
  };

  const db: Database = {
    query: (query) => run(activeTx.getStore() ?? pg, query),
    async transaction(fn) {
      const outer = activeTx.getStore();
      if (outer) return fn(); // вкладена операція — частина зовнішньої транзакції
      // spec-lab2 §4: помилку з fn (домен, баг, уже перекладена помилка запиту) не
      // перекладаємо вдруге — інакше TypeError у коді виглядав би як «БД недоступна» (503).
      let appError: { error: unknown } | undefined;
      try {
        return await pg.transaction((tx) =>
          activeTx.run(tx, async () => {
            try {
              return await fn();
            } catch (error) {
              appError = { error };
              throw error;
            }
          }),
        );
      } catch (err) {
        if (appError && err === appError.error) throw err;
        throw translateDbError(err); // збій BEGIN/COMMIT/ROLLBACK — це вже драйвер
      }
    },
    async exec(text) {
      countQuery();
      try {
        await (activeTx.getStore() ?? pg).exec(text);
      } catch (err) {
        throw translateDbError(err);
      }
    },
    inTransaction: () => activeTx.getStore() !== undefined,
    // spec-lab2 §4: повторний close() — no-op (подвійний SIGINT не валить процес)
    close: () => (closing ??= pg.close()),
  };

  // AC8 / рекомендація: явна ініціалізація + SELECT now() — падаємо одразу, а не на першому запиті
  try {
    await pg.waitReady;
    const [row] = await pg.query<{ now: Date }>('SELECT now() AS now').then((r) => r.rows);
    logger.info({ url: describeUrl(url), now: row?.now }, 'database ready');
  } catch (err) {
    throw new Error(`Database initialisation failed (${describeUrl(url)})`, { cause: err });
  }
  return db;
};
