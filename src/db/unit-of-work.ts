import { logger, SourceUnavailableError, type UnitOfWork } from '../shared/index.js';
import type { Database } from './database.js';
import { isTransientConflict } from './errors.js';

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 20;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Реалізація порту UnitOfWork (spec D6) поверх транзакції БД.
 * Транзієнтні конфлікти (40001/40P01) повторюються з експоненційним backoff (spec-lab2 §4).
 * Повтор безпечний, бо операції ідемпотентні (AC9).
 */
export const createPgUnitOfWork = (db: Database): UnitOfWork => ({
  async run(operation) {
    if (db.inTransaction()) return operation();
    for (let attempt = 1; ; attempt++) {
      try {
        return await db.transaction(operation);
      } catch (err) {
        if (!isTransientConflict(err)) throw err;
        if (attempt >= MAX_ATTEMPTS) {
          throw new SourceUnavailableError('Transaction kept conflicting, retry later', {
            cause: err,
          });
        }
        const delay = BASE_DELAY_MS * 2 ** (attempt - 1);
        logger.warn({ attempt, delay }, 'transient transaction conflict, retrying');
        await sleep(delay);
      }
    }
  },
});
