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

describe('errorHandler: не кожен об’єкт зі status — помилка клієнта (T5)', () => {
  test('status 4xx, але expose: false → 500 без повідомлення', () => {
    const internal = Object.assign(new Error('internal library detail'), {
      status: 401,
      expose: false,
    });
    expect(handle(internal)).toMatchObject({ status: 500, body: { error: 'INTERNAL' } });
  });

  test('status 5xx з expose: true → 500, а не цей статус', () => {
    const err = Object.assign(new Error('bad gateway'), { status: 502, expose: true });
    expect(handle(err).status).toBe(500);
  });

  test.each([399, 500, 302])('поза 4xx: status %i з expose → 500 INTERNAL', (status) => {
    const err = Object.assign(new Error('x'), { status, expose: true });
    expect(handle(err)).toMatchObject({ status: 500, body: { error: 'INTERNAL' } });
  });

  test('status 4xx без поля expose → не клієнтська помилка (500)', () => {
    expect(handle(Object.assign(new Error('x'), { status: 404 })).status).toBe(500);
  });

  test('status-рядок "404" з expose → 500 (лише числовий статус)', () => {
    expect(handle(Object.assign(new Error('x'), { status: '404', expose: true })).status).toBe(500);
  });

  test.each([400, 415, 499])('межі діапазону: status %i з expose → цей статус', (status) => {
    const err = Object.assign(new Error('client'), { status, expose: true });
    expect(handle(err).status).toBe(status);
  });

  test('без status, рядок замість Error, null → 500', () => {
    expect(handle(Object.assign(new Error('x'), { expose: true })).status).toBe(500);
    expect(handle('just a string').status).toBe(500);
    expect(handle(null).status).toBe(500);
  });

  test('коди http-errors: 400 → VALIDATION, 415 → UNSUPPORTED_MEDIA_TYPE, інший 4xx → BAD_REQUEST', () => {
    const mk = (status: number): Error => Object.assign(new Error('m'), { status, expose: true });
    expect(handle(mk(400)).body).toMatchObject({ error: 'VALIDATION', message: 'm' });
    expect(handle(mk(415)).body).toMatchObject({ error: 'UNSUPPORTED_MEDIA_TYPE' });
    expect(handle(mk(422)).body).toMatchObject({ error: 'BAD_REQUEST' });
  });

  test('Retry-After лише для 503, не для інших доменних помилок', () => {
    expect(handle(new DomainError('CONFLICT', 'c')).headers).toEqual({});
  });
});
