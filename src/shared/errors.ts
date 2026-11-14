import type { Response } from 'express';

export type DomainErrorCode = 'NOT_FOUND' | 'CONFLICT' | 'VALIDATION';

export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

const STATUS_BY_CODE: Record<DomainErrorCode, number> = {
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION: 400,
};

export const sendDomainError = (res: Response, error: DomainError): void => {
  res.status(STATUS_BY_CODE[error.code]).json({ error: error.code, message: error.message });
};
