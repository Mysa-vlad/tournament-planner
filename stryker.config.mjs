// spec-lab3 T3: мутаційне тестування. Відтворення: npm run mutation
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  vitest: { configFile: 'vitest.config.ts' },
  coverageAnalysis: 'perTest',
  mutate: [
    'src/modules/**/*.ts',
    'packages/*/src/**/*.ts',
    'src/http/error-handler.ts',
    // реекспорти без логіки
    '!src/modules/**/index.ts',
    '!packages/*/src/index.ts',
    '!packages/*/src/contract.ts',
  ],
  reporters: ['clear-text', 'progress', 'html', 'json'],
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  jsonReporter: { fileName: 'reports/mutation/mutation.json' },
  thresholds: { high: 80, low: 70, break: 70 },
  concurrency: 4,
  tempDirName: '.stryker-tmp',
  cleanTempDir: 'always',
};
