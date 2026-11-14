export type DataSource = 'static' | 'pg';

export interface AppConfig {
  readonly port: number;
  readonly version: string;
  /** SHA задеплоєного коміту для /version (spec-lab4 AC19): GIT_SHA або RENDER_GIT_COMMIT */
  readonly gitSha: string;
  /** static — прототип на статичних даних; pg — PostgreSQL (spec-lab2 AC7) */
  readonly dataSource: DataSource;
  /** каталог даних PGlite; 'memory://' — окрема база в пам'яті на кожен прогін */
  readonly databaseUrl: string;
}

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): AppConfig => {
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid PORT: ${String(env.PORT)}`);
  }
  const dataSource = env.DATA_SOURCE ?? 'pg';
  if (dataSource !== 'static' && dataSource !== 'pg') {
    throw new Error(`Invalid DATA_SOURCE: ${dataSource} (expected static | pg)`);
  }
  return {
    port,
    version: env.npm_package_version ?? env.APP_VERSION ?? '0.0.0',
    gitSha: env.GIT_SHA ?? env.RENDER_GIT_COMMIT ?? 'unknown',
    dataSource,
    databaseUrl: env.DATABASE_URL ?? './.data/pg',
  };
};
