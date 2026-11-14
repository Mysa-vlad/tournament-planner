import type { NextFunction, Request, Response } from 'express';
import { describe, expect, test } from 'vitest';
import { z } from 'zod';
import { errorHandler } from '../../src/http/error-handler.js';
import { DomainError, SourceUnavailableError, runWithContext } from '../../src/shared/index.js';

interface Captured {
  status?: number;
  body?: unknown;
  headers: Record<string, string>;
}

/** Мінімальний фейк express Response, достатній для обробника. */
const handle = (err: unknown): Captured => {
  const out: Captured = { headers: {} };
  const res = {
    status(code: number) {
      out.status = code;
      return this;
    },
    json(body: unknown) {
      out.body = body;
      return this;
    },
    setHeader(name: string, value: string) {
      out.headers[name] = value;
      return this;
    },
  } as unknown as Response;
  runWithContext({ requestId: 'req-1', userId: undefined, queryCount: 0 }, () => {
    errorHandler(err, {} as Request, res, (() => undefined) as NextFunction);
  });
  return out;
};

describe('errorHandler (spec-lab2 §4, D8)', () => {
  test.each([
    ['VALIDATION', 400],
    ['UNAUTHENTICATED', 401],
    ['FORBIDDEN', 403],
    ['NOT_FOUND', 404],
    ['CONFLICT', 409],
  ] as const)('DomainError %s → %i з requestId', (code, status) => {
    const out = handle(new DomainError(code, 'msg'));
    expect(out.status).toBe(status);
    expect(out.body).toEqual({ error: code, message: 'msg', requestId: 'req-1' });
  });

  test('SourceUnavailableError → 503 + Retry-After', () => {
    const out = handle(new SourceUnavailableError('db down'));
    expect(out.status).toBe(503);
    expect(out.headers['Retry-After']).toBe('5');
  });

  test('ZodError → 400 зі списком полів', () => {
    const parsed = z.object({ n: z.number() }).safeParse({ n: 'x' });
    const out = handle(parsed.error);
    expect(out.status).toBe(400);
    expect(out.body).toMatchObject({ error: 'VALIDATION', fields: [{ path: 'n' }] });
  });

  test('http-errors від body-parser зберігають статус (413)', () => {
    const err = Object.assign(new Error('request entity too large'), { status: 413, expose: true });
    expect(handle(err)).toMatchObject({ status: 413, body: { error: 'PAYLOAD_TOO_LARGE' } });
  });

  test('невідома помилка → 500 без деталей', () => {
    const out = handle(new Error('secret stack info'));
    expect(out.status).toBe(500);
    expect(out.body).toEqual({
      error: 'INTERNAL',
      message: 'Internal server error',
      requestId: 'req-1',
    });
  });
});
