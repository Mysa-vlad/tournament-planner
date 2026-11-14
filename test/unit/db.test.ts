import { describe, expect, test, vi } from 'vitest';
import type { Database } from '../../src/db/database.js';
import { isTransientConflict, isUniqueViolation, translateDbError } from '../../src/db/errors.js';
import { sql } from '../../src/db/sql.js';
import { createPgUnitOfWork } from '../../src/db/unit-of-work.js';
import { SourceUnavailableError } from '../../src/shared/index.js';

const pgError = (code: string): Error => Object.assign(new Error(`pg ${code}`), { code });

describe('sql tagged template', () => {
  test('значення стають параметрами $1..$n, а не текстом', () => {
    const name = "x'; DROP TABLE teams; --";
    expect(sql`SELECT * FROM teams WHERE name = ${name} AND city = ${'Київ'}`).toEqual({
      text: 'SELECT * FROM teams WHERE name = $1 AND city = $2',
      values: [name, 'Київ'],
    });
  });
});

describe('класифікація помилок БД (spec-lab2 §4)', () => {
  test('unique / transient', () => {
    expect(isUniqueViolation(pgError('23505'))).toBe(true);
    expect(isUniqueViolation(pgError('23503'))).toBe(false);
    expect(isTransientConflict(pgError('40001'))).toBe(true);
    expect(isTransientConflict(pgError('40P01'))).toBe(true);
    expect(isTransientConflict(pgError('23505'))).toBe(false);
  });

  test.each(['08006', '57P01', '53300'])('збій джерела %s → SourceUnavailableError', (code) => {
    expect(translateDbError(pgError(code))).toBeInstanceOf(SourceUnavailableError);
  });

  test('помилка без SQLSTATE (закрите з’єднання) → SourceUnavailableError', () => {
    expect(translateDbError(new Error('PGlite is closed'))).toBeInstanceOf(SourceUnavailableError);
  });

  test('помилка запиту (23505) передається як є', () => {
    const err = pgError('23505');
    expect(translateDbError(err)).toBe(err);
  });
});

describe('createPgUnitOfWork: повтори транзієнтних конфліктів', () => {
  const fakeDb = (failures: Error[]): Database & { calls: number } => {
    const db = {
      calls: 0,
      inTransaction: () => false,
      async transaction<T>(fn: () => Promise<T>): Promise<T> {
        db.calls += 1;
        const failure = failures.shift();
        if (failure !== undefined) throw failure;
        return fn();
      },
      query: () => Promise.resolve([]),
      exec: () => Promise.resolve(),
      close: () => Promise.resolve(),
    };
    return db;
  };

  test('40001 двічі, потім успіх → результат, 3 спроби', async () => {
    vi.useFakeTimers();
    const db = fakeDb([pgError('40001'), pgError('40P01')]);
    const promise = createPgUnitOfWork(db).run(() => Promise.resolve('ok'));
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe('ok');
    expect(db.calls).toBe(3);
    vi.useRealTimers();
  });

  test('конфлікт щоразу → після 3 спроб SourceUnavailableError', async () => {
    vi.useFakeTimers();
    const db = fakeDb([pgError('40001'), pgError('40001'), pgError('40001'), pgError('40001')]);
    const promise = createPgUnitOfWork(db).run(() => Promise.resolve('never'));
    const assertion = expect(promise).rejects.toBeInstanceOf(SourceUnavailableError);
    await vi.runAllTimersAsync();
    await assertion;
    expect(db.calls).toBe(3);
    vi.useRealTimers();
  });

  test('не-транзієнтна помилка не повторюється', async () => {
    const db = fakeDb([pgError('23505')]);
    await expect(createPgUnitOfWork(db).run(() => Promise.resolve(1))).rejects.toMatchObject({
      code: '23505',
    });
    expect(db.calls).toBe(1);
  });

  test('вкладений виклик усередині транзакції не відкриває нову', async () => {
    const db = { ...fakeDb([]), inTransaction: () => true };
    await expect(createPgUnitOfWork(db).run(() => Promise.resolve(7))).resolves.toBe(7);
    expect(db.calls).toBe(0);
  });
});

describe('адаптер PostgreSQL-сервера (spec-lab4)', () => {
  test('describeUrl ніколи не показує пароль', async () => {
    const { describeUrl, isPostgresUrl } = await import('../../src/db/database.js');
    expect(describeUrl('postgresql://user:s3cret@ep-x.neon.tech/app?sslmode=require')).toBe(
      'postgresql://ep-x.neon.tech/app',
    );
    expect(describeUrl('memory://')).toBe('memory://');
    expect(describeUrl('./.data/pg')).toBe('file');
    expect(describeUrl('postgres://[bad')).toBe('invalid-url');
    expect(isPostgresUrl('postgres://h/db')).toBe(true);
    expect(isPostgresUrl('postgresql://h/db')).toBe(true);
    expect(isPostgresUrl('memory://')).toBe(false);
  });

  test('мережеві коди Node (ECONNREFUSED) — це збій джерела, а не SQLSTATE', () => {
    const err = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
    expect(translateDbError(err)).toBeInstanceOf(SourceUnavailableError);
  });

  test('недоступний PostgreSQL на старті → помилка ініціалізації без пароля в тексті', async () => {
    const { createDatabase } = await import('../../src/db/database.js');
    const attempt = createDatabase('postgres://u:topsecret@127.0.0.1:1/none');
    await expect(attempt).rejects.toThrow(
      'Database initialisation failed (postgres://127.0.0.1/none)',
    );
    await expect(attempt).rejects.not.toThrow(/topsecret/);
  });
});
