// spec D5: ядро без залежностей від фреймворків — лише доменні помилки, без HTTP.
export type DomainErrorCode =
  'VALIDATION' | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'SOURCE_UNAVAILABLE';

export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

/** Джерело даних недоступне (spec-lab2 §4) → 503. */
export class SourceUnavailableError extends DomainError {
  constructor(message: string, options?: { cause?: unknown }) {
    super('SOURCE_UNAVAILABLE', message);
    this.name = 'SourceUnavailableError';
    if (options?.cause !== undefined) this.cause = options.cause;
  }
}
