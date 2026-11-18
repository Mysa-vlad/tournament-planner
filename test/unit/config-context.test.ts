import { describe, expect, test } from 'vitest';
import { loadConfig } from '../../src/config/env.js';
import {
  countQuery,
  currentContext,
  requireUserId,
  runWithContext,
} from '../../src/shared/index.js';

describe('loadConfig', () => {
  test('значення за замовчуванням', () => {
    expect(loadConfig({})).toEqual({
      port: 3000,
      version: '0.0.0',
      dataSource: 'pg',
      databaseUrl: './.data/pg',
    });
  });

  test('змінні середовища', () => {
    expect(
      loadConfig({
        PORT: '8080',
        DATA_SOURCE: 'static',
        DATABASE_URL: 'memory://',
        npm_package_version: '1.2.3',
      }),
    ).toEqual({ port: 8080, version: '1.2.3', dataSource: 'static', databaseUrl: 'memory://' });
  });

  test.each(['0', '-1', '3.5', 'abc'])('невалідний PORT=%s → помилка', (port) => {
    expect(() => loadConfig({ PORT: port })).toThrow(/Invalid PORT/);
  });

  test('невалідний DATA_SOURCE → помилка', () => {
    expect(() => loadConfig({ DATA_SOURCE: 'mongo' })).toThrow(/Invalid DATA_SOURCE/);
  });
});

describe('request-контекст (D7)', () => {
  test('поза запитом контексту немає, requireUserId → UNAUTHENTICATED', () => {
    expect(currentContext()).toBeUndefined();
    expect(() => requireUserId()).toThrow(expect.objectContaining({ code: 'UNAUTHENTICATED' }));
    expect(() => {
      countQuery();
    }).not.toThrow();
  });

  test('у запиті: userId доступний, countQuery рахує', () => {
    const ctx = { requestId: 'r', userId: 'u1', queryCount: 0 };
    runWithContext(ctx, () => {
      expect(requireUserId()).toBe('u1');
      countQuery();
      countQuery();
    });
    expect(ctx.queryCount).toBe(2);
  });
});
