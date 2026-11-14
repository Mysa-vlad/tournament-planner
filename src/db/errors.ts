import { SourceUnavailableError } from '../shared/index.js';

/**
 * PostgreSQL SQLSTATE з помилки драйвера (PGlite/pg кладуть його в `code`).
 * Лише 5 символів [0-9A-Z]: мережеві коди Node (`ECONNREFUSED`, `ETIMEDOUT`) — не SQLSTATE,
 * це збій джерела (spec-lab4: pg-адаптер до віддаленого сервера).
 */
export const sqlState = (err: unknown): string | undefined =>
  typeof err === 'object' &&
  err !== null &&
  'code' in err &&
  typeof err.code === 'string' &&
  /^[0-9A-Z]{5}$/.test(err.code)
    ? err.code
    : undefined;

export const isUniqueViolation = (err: unknown): boolean => sqlState(err) === '23505';

/** 40001 serialization_failure, 40P01 deadlock_detected — безпечно повторити транзакцію. */
export const isTransientConflict = (err: unknown): boolean => {
  const state = sqlState(err);
  return state === '40001' || state === '40P01';
};

/**
 * Збій самого джерела, а не запиту: з'єднання (08xxx), адмінське завершення (57P0x),
 * брак ресурсів (53xxx), або помилка без SQLSTATE (закрите з'єднання, мережа).
 */
const isSourceFailure = (err: unknown): boolean => {
  const state = sqlState(err);
  if (state === undefined) return true;
  return state.startsWith('08') || state.startsWith('57P') || state.startsWith('53');
};

/** spec-lab2 §4: збій джерела → SourceUnavailableError (503); помилки SQL — як є. */
export const translateDbError = (err: unknown): unknown =>
  isSourceFailure(err)
    ? new SourceUnavailableError('Database is unavailable', { cause: err })
    : err;
