import { defineConfig } from 'vitest/config';

// spec-lab3 AC14: E2E проти зібраного артефакту (npm run build перед запуском)
export default defineConfig({
  test: {
    include: ['test/e2e/**/*.e2e.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
