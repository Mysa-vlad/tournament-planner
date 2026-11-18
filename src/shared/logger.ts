import { pino, type Logger } from 'pino';
import { currentContext } from './context.js';

/**
 * spec D7 / AC10: кожен запис логу автоматично містить requestId і userId з
 * AsyncLocalStorage — з будь-якого рівня (роут, сервіс, репозиторій, БД).
 */
export const logger: Logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: null,
  mixin() {
    const ctx = currentContext();
    return ctx ? { requestId: ctx.requestId, userId: ctx.userId } : {};
  },
});
