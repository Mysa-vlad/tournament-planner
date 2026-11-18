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
    {
      name: 'D5-shared-kernel-is-pure',
      comment: 'spec D5: shared не залежить від фреймворків і від інших шарів',
      severity: 'error',
      from: { path: '^src/shared/' },
      to: { path: ['node_modules/express/', '^src/(modules|http|config)/'] },
    },
    {
      name: 'D6-sql-only-in-db-and-repositories',
      comment: 'spec-lab2 D6: SQL і транзакції — лише в src/db/ та *.repository.ts',
      severity: 'error',
      from: {
        path: '^src/',
        pathNot: ['^src/db/', '\\.repository\\.ts$', '^src/composition\\.ts$'],
      },
      to: { path: ['^src/db/', 'node_modules/@electric-sql/'] },
    },
    {
      name: 'D10-package-is-standalone',
      comment:
        'spec-lab5 D10: пакет не імпортує застосунок (src/) і жодних npm-залежностей (драйвер БД, express…)',
      severity: 'error',
      from: { path: '^packages/[^/]+/src/' },
      to: { path: ['^src/', 'node_modules/'] },
    },
    {
      name: 'D10-package-is-standalone-core',
      comment: 'spec-lab5 D10: і жодних модулів Node (fs, net…) — лише чистий TypeScript',
      severity: 'error',
      from: { path: '^packages/[^/]+/src/' },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'D11-package-public-entry-only',
      comment: 'spec-lab5 D11: застосунок імпортує пакет лише через його точку входу (index.ts)',
      severity: 'error',
      from: { path: '^src/' },
      to: { path: '^packages/[^/]+/', pathNot: '^packages/[^/]+/src/index\\.ts$' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    // tp-source: пакети workspace резолвляться у src/ (як у tsc), щоб D10/D11 бачили справжні файли
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['tp-source', 'import', 'require'],
    },
  },
};
