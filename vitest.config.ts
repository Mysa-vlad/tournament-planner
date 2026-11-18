import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// spec-lab3 T1/T2: пороги покриття — частина прогону (падає, якщо їх не досягнуто)
export default defineConfig({
  resolve: {
    // spec-lab5: тести беруть пакет із джерела (як tsc з умовою tp-source), без збірки dist
    alias: {
      '@tournament-planner/standings': fileURLToPath(
        new URL('./packages/standings/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    include: [
      'test/unit/**/*.test.ts',
      'test/integration/**/*.test.ts',
      'packages/*/test/**/*.test.ts',
    ],
    env: { LOG_LEVEL: 'silent' },
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'packages/*/src/**/*.ts'],
      // точка входу процесу — покривається E2E (окремий процес), а не in-process тестами
      // src/db/cli.ts — точка входу CD-кроку міграцій (як server.ts);
      // src/db/postgres.ts — адаптер PostgreSQL-сервера: його покриває CI-job test-postgres
      // (TEST_DATABASE_URL), а не цей прогін на PGlite (spec-lab4 AC22)
      // src/profiling.ts — увімкнення профайлера процесу (npm run profile), як і server.ts
      exclude: [
        'src/server.ts',
        'src/profiling.ts',
        'src/prototype/**',
        'src/db/cli.ts',
        'src/db/postgres.ts',
      ],
      reporter: ['text-summary', 'text', 'html'],
      reportsDirectory: 'reports/coverage',
      thresholds: {
        branches: 85,
        lines: 90,
        functions: 90,
        statements: 90,
        // T1: повне покриття модуля standings і доменної логіки розкладу
        'src/modules/standings/**': { branches: 100, lines: 100, functions: 100, statements: 100 },
        // spec-lab5 AC28: винесений пакет таблиці — так само повністю
        'packages/standings/src/**': { branches: 100, lines: 100, functions: 100, statements: 100 },
        'src/modules/matches/matches.domain.ts': {
          branches: 100,
          lines: 100,
          functions: 100,
          statements: 100,
        },
      },
    },
  },
});
