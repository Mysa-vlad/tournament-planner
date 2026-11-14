// Правила залежностей зі spec.md §6. Кожне правило має id D* — на нього посилаються аудит і DEFENSE.
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'D1-no-circular',
      comment: 'spec D1: немає циклічних залежностей',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'D2-module-public-api-only',
      comment: 'spec D2: модуль імпортує інший модуль лише через його index.ts',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/' },
      to: {
        path: '^src/modules/([^/]+)/',
        pathNot: ['^src/modules/$1/', '^src/modules/[^/]+/index\\.ts$'],
      },
    },
    {
      name: 'D3-domain-without-express',
      comment: 'spec D3: доменний код (*.service.ts, *.domain.ts) не імпортує express',
      severity: 'error',
      from: { path: '\\.(service|domain)\\.ts$' },
      to: { path: 'node_modules/express/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'require'] },
  },
};
