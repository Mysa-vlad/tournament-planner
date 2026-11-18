import { createContainer } from './composition.js';
import { loadConfig } from './config/env.js';
import { createApp } from './http/app.js';
import { startProfilingIfRequested } from './profiling.js';
import { logger } from './shared/index.js';

const main = async (): Promise<void> => {
  await startProfilingIfRequested(); // лише з CPU_PROFILE_DIR (npm run profile)
  const config = loadConfig();
  // AC8: якщо ресурс (БД) недоступний — падаємо тут, до прийому запитів
  const container = await createContainer(config);
  const app = createApp(container, { version: config.version, gitSha: config.gitSha });

  const server = app.listen(config.port, () => {
    logger.info(
      { port: config.port, dataSource: config.dataSource, sha: config.gitSha },
      'server started',
    );
  });

  let stopping = false;
  const shutdown = (signal: string): void => {
    if (stopping) return; // повторний сигнал під час зупинки ігноруємо
    stopping = true;
    logger.info({ signal }, 'shutting down');
    server.close(() => {
      void container.close().finally(() => process.exit(0));
    });
  };
  process.on('SIGINT', () => {
    shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    shutdown('SIGTERM');
  });
};

main().catch((err: unknown) => {
  logger.fatal({ err }, 'failed to start');
  process.exit(1);
});
