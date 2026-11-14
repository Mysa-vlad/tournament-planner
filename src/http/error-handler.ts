import type { ErrorRequestHandler } from 'express';
import { DomainError, sendDomainError } from '../shared/index.js';

export const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
  if (err instanceof DomainError) {
    sendDomainError(res, err);
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'INTERNAL', message: 'Internal server error' });
};
