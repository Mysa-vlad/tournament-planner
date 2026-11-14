import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { logger, runWithContext, type RequestContext } from '../shared/index.js';

const REQUEST_ID = /^[\w-]{8,64}$/;

/**
 * spec D7: єдина точка, де HTTP-запит перетворюється на request-контекст.
 * Далі requestId і ініціатор доступні на будь-якому рівні через AsyncLocalStorage.
 */
export const contextMiddleware: RequestHandler = (req, res, next) => {
  const incoming = req.header('x-request-id');
  const userId = req.header('x-user-id')?.trim();
  const ctx: RequestContext = {
    requestId: incoming && REQUEST_ID.test(incoming) ? incoming : randomUUID(),
    userId: userId === '' ? undefined : userId,
    queryCount: 0,
  };
  res.setHeader('X-Request-Id', ctx.requestId);

  const startedAt = performance.now();
  res.on('finish', () => {
    // 'finish' може статися поза контекстом — передаємо значення явно
    logger.info(
      {
        requestId: ctx.requestId,
        userId: ctx.userId,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs: Math.round(performance.now() - startedAt),
        queries: ctx.queryCount,
      },
      'request completed',
    );
  });

  runWithContext(ctx, next);
};
