import { describe, expect, test } from 'vitest';
import { loadConfig, readPackageVersion } from '../../src/config/env.js';
import {
  countQuery,
  currentContext,
  requireUserId,
  runWithContext,
} from '../../src/shared/index.js';

describe('loadConfig', () => {
  test('значення за замовчуванням', () => {
    expect(loadConfig({}, () => undefined)).toEqual({
      port: 3000,
      version: '0.0.0',
      gitSha: 'unknown',
      dataSource: 'pg',
      databaseUrl: './.data/pg',
      standingsCacheTtlMs: 5000,
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
        STANDINGS_CACHE_TTL_MS: '0',
      }),
    ).toEqual({
      port: 8080,
      version: '1.2.3',
      gitSha: 'abc123',
      dataSource: 'static',
      databaseUrl: 'memory://',
      standingsCacheTtlMs: 0,
    });
  });

  test('некоректний STANDINGS_CACHE_TTL_MS — помилка старту (spec-lab5 AC30)', () => {
    expect(() => loadConfig({ STANDINGS_CACHE_TTL_MS: '-1' })).toThrow(/STANDINGS_CACHE_TTL_MS/);
    expect(() => loadConfig({ STANDINGS_CACHE_TTL_MS: 'abc' })).toThrow(/STANDINGS_CACHE_TTL_MS/);
  });

  test('SHA і версія на Render: RENDER_GIT_COMMIT, APP_VERSION (spec-lab4 AC19)', () => {
    expect(loadConfig({ RENDER_GIT_COMMIT: 'def456', APP_VERSION: '0.4.0' })).toMatchObject({
      gitSha: 'def456',
      version: '0.4.0',
    });
    // явний GIT_SHA має пріоритет
    expect(loadConfig({ GIT_SHA: 'x', RENDER_GIT_COMMIT: 'y' }).gitSha).toBe('x');
  });

  // регресія першого CD-прогону: Dockerfile ставив GIT_SHA=unknown, і /version віддавав 'unknown'
  test('заглушка чи порожній GIT_SHA не перекриває RENDER_GIT_COMMIT (spec-lab4 AC19)', () => {
    expect(loadConfig({ GIT_SHA: 'unknown', RENDER_GIT_COMMIT: 'abc123' }).gitSha).toBe('abc123');
    expect(loadConfig({ GIT_SHA: '', RENDER_GIT_COMMIT: 'abc123' }).gitSha).toBe('abc123');
    expect(loadConfig({ GIT_SHA: '  ', RENDER_GIT_COMMIT: 'abc123' }).gitSha).toBe('abc123');
    expect(loadConfig({ GIT_SHA: 'unknown' }).gitSha).toBe('unknown');
  });

  test('версія з package.json, коли npm не задав npm_package_version (запуск node у контейнері)', () => {
    expect(loadConfig({}, () => '9.9.9').version).toBe('9.9.9');
    expect(loadConfig({ npm_package_version: '' }, () => '9.9.9').version).toBe('9.9.9');
    expect(readPackageVersion()).toMatch(/^\d+\.\d+\.\d+/);
    expect(readPackageVersion(new URL('file:///does/not/exist.json'))).toBeUndefined();
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
