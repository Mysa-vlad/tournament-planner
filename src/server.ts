import { createContainer } from './composition.js';
import { loadConfig } from './config/env.js';
import { createApp } from './http/app.js';
import { logger } from './shared/index.js';

const main = async (): Promise<void> => {
  const config = loadConfig();
  // AC8: якщо ресурс (БД) недоступний — падаємо тут, до прийому запитів
  const container = await createContainer(config);
  const app = createApp(container.services, { version: config.version });

  const server = app.listen(config.port, () => {
    logger.info({ port: config.port, dataSource: config.dataSource }, 'server started');
  });

  const shutdown = (signal: string): void => {
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
