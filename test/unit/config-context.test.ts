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
      gitSha: 'unknown',
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
        GIT_SHA: 'abc123',
      }),
    ).toEqual({
      port: 8080,
      version: '1.2.3',
      gitSha: 'abc123',
      dataSource: 'static',
      databaseUrl: 'memory://',
    });
  });

  test('SHA і версія на Render: RENDER_GIT_COMMIT, APP_VERSION (spec-lab4 AC19)', () => {
    expect(loadConfig({ RENDER_GIT_COMMIT: 'def456', APP_VERSION: '0.4.0' })).toMatchObject({
      gitSha: 'def456',
      version: '0.4.0',
    });
    // явний GIT_SHA має пріоритет
    expect(loadConfig({ GIT_SHA: 'x', RENDER_GIT_COMMIT: 'y' }).gitSha).toBe('x');
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
