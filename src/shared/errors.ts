// spec D5: ядро без залежностей від фреймворків — лише доменна помилка, без HTTP.
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
