export interface AppConfig {
  readonly port: number;
  readonly version: string;
}

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): AppConfig => {
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid PORT: ${String(env.PORT)}`);
  }
  return { port, version: env.npm_package_version ?? '0.0.0' };
};
