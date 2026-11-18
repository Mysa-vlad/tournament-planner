import { readFileSync } from 'node:fs';

export type DataSource = 'static' | 'pg';

const PLACEHOLDER = 'unknown';

/** spec-lab4 AC19: перше справжнє значення; порожнє чи заглушка 'unknown' не рахуються. */
const firstKnown = (...values: readonly (string | undefined)[]): string | undefined =>
  values.map((v) => v?.trim()).find((v) => v !== undefined && v !== '' && v !== PLACEHOLDER);

/** Версія з package.json: у контейнері node запускається напряму, без npm_package_version. */
export const readPackageVersion = (
  url: URL = new URL('../../package.json', import.meta.url),
): string | undefined => {
  try {
    const pkg = JSON.parse(readFileSync(url, 'utf8')) as { version?: unknown };
    return typeof pkg.version === 'string' ? pkg.version : undefined;
  } catch {
    return undefined;
  }
};

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

export const loadConfig = (
  env: NodeJS.ProcessEnv = process.env,
  packageVersion: () => string | undefined = readPackageVersion,
): AppConfig => {
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
    version: firstKnown(env.npm_package_version, env.APP_VERSION) ?? packageVersion() ?? '0.0.0',
    gitSha: firstKnown(env.GIT_SHA, env.RENDER_GIT_COMMIT) ?? PLACEHOLDER,
    dataSource,
    databaseUrl: env.DATABASE_URL ?? './.data/pg',
  };
};
