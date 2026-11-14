import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import {
  currentContext,
  DomainError,
  logger,
  SourceUnavailableError,
  type DomainErrorCode,
} from '../shared/index.js';

// spec D5: мапінг доменних помилок на HTTP-статуси живе в шарі http, а не в shared.
const STATUS_BY_CODE: Record<DomainErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  SOURCE_UNAVAILABLE: 503,
};

const RETRY_AFTER_SECONDS = '5';

const isBodyParseError = (err: unknown): boolean =>
  err instanceof SyntaxError && 'type' in err && err.type === 'entity.parse.failed';

/** spec D8: єдиний глобальний обробник помилок (spec-lab2 §4). */
export const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
  const requestId = currentContext()?.requestId;

  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'VALIDATION',
      message: 'Invalid request',
      fields: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      requestId,
    });
    return;
  }
  if (isBodyParseError(err)) {
    res.status(400).json({ error: 'VALIDATION', message: 'Malformed JSON body', requestId });
    return;
  }
  if (err instanceof DomainError) {
    if (err instanceof SourceUnavailableError) {
      logger.error({ err }, 'data source unavailable');
      res.setHeader('Retry-After', RETRY_AFTER_SECONDS);
    }
    res.status(STATUS_BY_CODE[err.code]).json({ error: err.code, message: err.message, requestId });
    return;
  }

  logger.error({ err }, 'unhandled error');
  res.status(500).json({ error: 'INTERNAL', message: 'Internal server error', requestId });
};
