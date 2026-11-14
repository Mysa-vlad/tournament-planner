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

/**
 * Клієнтські помилки HTTP-рівня від body-parser (http-errors): битий JSON (400),
 * завелике тіло (413), непідтримуване кодування (415) — мають власний 4xx-статус.
 */
const clientHttpErrorStatus = (err: unknown): number | undefined => {
  if (typeof err !== 'object' || err === null) return undefined;
  const status = 'status' in err ? err.status : undefined;
  const expose = 'expose' in err ? err.expose : false;
  return typeof status === 'number' && status >= 400 && status < 500 && expose === true
    ? status
    : undefined;
};

const HTTP_ERROR_CODE: Record<number, string> = {
  400: 'VALIDATION',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
};

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
  const httpStatus = clientHttpErrorStatus(err);
  if (httpStatus !== undefined) {
    res.status(httpStatus).json({
      error: HTTP_ERROR_CODE[httpStatus] ?? 'BAD_REQUEST',
      message: err instanceof Error ? err.message : 'Bad request',
      requestId,
    });
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
