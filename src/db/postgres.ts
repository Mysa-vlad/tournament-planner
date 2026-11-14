import { AsyncLocalStorage } from 'node:async_hooks';
import pg from 'pg';
import { countQuery, logger } from '../shared/index.js';
import { describeUrl, type Database } from './contract.js';
import { translateDbError } from './errors.js';
import type { SqlQuery } from './sql.js';

/**
 * Адаптер PostgreSQL-сервера (spec-lab4 §4, ADR 0007): пул з'єднань pg за тим самим
 * інтерфейсом `Database`, що й PGlite. Транзакція тримає ОДНЕ з'єднання з пулу і
 * лежить в AsyncLocalStorage — репозиторії не змінюються.
 */
export const createPostgresDatabase = async (url: string): Promise<Database> => {
  const pool = new pg.Pool({
    connectionString: url,
    max: Number(process.env.DB_POOL_MAX ?? 5),
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    // керовані сервіси (Neon, Render) вимагають TLS; локальний сервер CI — ні
    ssl: /sslmode=require/.test(url) ? { rejectUnauthorized: false } : undefined,
  });
  // помилка неактивного з'єднання в пулі не повинна валити процес
  pool.on('error', (err) => {
    logger.error({ err }, 'idle postgres client error');
  });
  const activeTx = new AsyncLocalStorage<pg.PoolClient>();
  let closing: Promise<void> | undefined;

  const run = async <Row>(query: SqlQuery): Promise<Row[]> => {
    countQuery();
    const startedAt = performance.now();
    try {
      const executor = activeTx.getStore() ?? pool;
      const result = await executor.query(query.text, [...query.values]);
      logger.debug({ sql: query.text, ms: Math.round(performance.now() - startedAt) }, 'db query');
      return result.rows as Row[];
    } catch (err) {
      throw translateDbError(err);
    }
  };

  const db: Database = {
    query: run,
    async transaction(fn) {
      if (activeTx.getStore()) return fn();
      let client: pg.PoolClient;
      try {
        client = await pool.connect();
      } catch (err) {
        throw translateDbError(err);
      }
      let appError: { error: unknown } | undefined;
      try {
        await client.query('BEGIN');
        const result = await activeTx.run(client, async () => {
          try {
            return await fn();
          } catch (error) {
            appError = { error };
            throw error;
          }
        });
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        if (appError && err === appError.error) throw err;
        throw translateDbError(err);
      } finally {
        client.release();
      }
    },
    async exec(text) {
      countQuery();
      try {
        await (activeTx.getStore() ?? pool).query(text);
      } catch (err) {
        throw translateDbError(err);
      }
    },
    inTransaction: () => activeTx.getStore() !== undefined,
    close: () => (closing ??= pool.end()),
  };

  // AC8: явна ініціалізація пулу + SELECT now() — падаємо одразу (рекомендація курсу)
  try {
    const { rows } = await pool.query<{ now: Date }>('SELECT now() AS now');
    logger.info({ url: describeUrl(url), now: rows[0]?.now }, 'database ready');
  } catch (err) {
    await pool.end().catch(() => undefined);
    throw new Error(`Database initialisation failed (${describeUrl(url)})`, { cause: err });
  }
  return db;
};
