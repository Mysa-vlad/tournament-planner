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
    {
      name: 'D4-teams-is-leaf',
      comment: 'spec D4: teams не залежить від інших доменних модулів',
      severity: 'error',
      from: { path: '^src/modules/teams/' },
      to: { path: '^src/modules/(tournaments|matches|standings)/' },
    },
    {
      name: 'D4-tournaments-direction',
      comment: 'spec D4 / граф §3: tournaments залежить лише від teams',
      severity: 'error',
      from: { path: '^src/modules/tournaments/' },
      to: { path: '^src/modules/(matches|standings)/' },
    },
    {
      name: 'D4-matches-direction',
      comment: 'spec D4 / граф §3: matches не залежить від standings',
      severity: 'error',
      from: { path: '^src/modules/matches/' },
      to: { path: '^src/modules/standings/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'require'] },
  },
};
