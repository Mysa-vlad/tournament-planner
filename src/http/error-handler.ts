import type { ErrorRequestHandler } from 'express';
import { DomainError, type DomainErrorCode } from '../shared/index.js';

// spec D5: мапінг доменних помилок на HTTP-статуси живе в шарі http, а не в shared.
const STATUS_BY_CODE: Record<DomainErrorCode, number> = {
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION: 400,
};

export const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
  if (err instanceof DomainError) {
    res.status(STATUS_BY_CODE[err.code]).json({ error: err.code, message: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'INTERNAL', message: 'Internal server error' });
};
