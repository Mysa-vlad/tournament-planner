import { AsyncLocalStorage } from 'node:async_hooks';
import { DomainError } from './errors.js';

/**
 * spec D7: request-контекст без протягування параметрів.
 * Встановлюється один раз на вході (HTTP middleware) і доступний на будь-якому рівні.
 */
export interface RequestContext {
  /** business-process ID: потрапляє в кожен лог і в заголовок X-Request-Id */
  readonly requestId: string;
  /** ініціатор операції (X-User-Id); undefined для анонімних читань */
  readonly userId: string | undefined;
  /** лічильник SQL-запитів у межах запиту — для виявлення N+1 */
  queryCount: number;
}

const storage = new AsyncLocalStorage<RequestContext>();

export const runWithContext = <T>(ctx: RequestContext, fn: () => T): T => storage.run(ctx, fn);

export const currentContext = (): RequestContext | undefined => storage.getStore();

/** Ініціатор обов'язковий для операцій запису (spec-lab2 §2). */
export const requireUserId = (): string => {
  const userId = storage.getStore()?.userId;
  if (userId === undefined) {
    throw new DomainError('UNAUTHENTICATED', 'X-User-Id header is required for this operation');
  }
  return userId;
};

export const countQuery = (): void => {
  const ctx = storage.getStore();
  if (ctx) ctx.queryCount += 1;
};
