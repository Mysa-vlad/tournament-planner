import type { SqlQuery } from './sql.js';

/**
 * Ресурс БД: створюється й перевіряється ОДИН раз на старті (composition root).
 * Дві реалізації за одним контрактом: вбудований PGlite і PostgreSQL-сервер (pg.Pool).
 * spec D6: транзакції й SQL живуть лише в src/db і *.repository.ts; активна транзакція
 * лежить в AsyncLocalStorage — репозиторіям не треба передавати `tx`.
 */
export interface Database {
  query<Row>(query: SqlQuery): Promise<Row[]>;
  /** BEGIN … COMMIT; запити всередині автоматично йдуть у цю транзакцію (через ALS) */
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  /** кілька SQL-операторів без параметрів (міграції) */
  exec(text: string): Promise<void>;
  inTransaction(): boolean;
  close(): Promise<void>;
}

/** Безпечний опис адреси для логів і помилок: пароль ніколи не потрапляє в лог. */
export const describeUrl = (url: string): string => {
  if (url.startsWith('memory')) return url;
  if (!url.includes('://')) return 'file';
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}${u.pathname}`;
  } catch {
    return 'invalid-url';
  }
};

export const isPostgresUrl = (url: string): boolean => /^postgres(ql)?:\/\//.test(url);
