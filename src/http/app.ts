import express, { type Express } from 'express';
import type { Container } from '../composition.js';
import { createMatchesRouter } from '../modules/matches/index.js';
import { createStandingsRouter } from '../modules/standings/index.js';
import { createTeamsRouter } from '../modules/teams/index.js';
import { createTournamentsRouter } from '../modules/tournaments/index.js';
import { contextMiddleware } from './context-middleware.js';
import { errorHandler } from './error-handler.js';
import { metricsHandler } from './metrics.js';

/** HTTP-рівень: знає лише про маршрути й формат; сервіси приходять готовими з composition root. */
export interface AppInfo {
  readonly version: string;
  readonly gitSha: string;
}

export const createApp = (
  container: Pick<Container, 'services' | 'readiness'>,
  info: AppInfo,
): Express => {
  const { services } = container;
  const startedAt = new Date().toISOString();
  const app = express();
  app.disable('x-powered-by');
  app.use(contextMiddleware);
  app.use(express.json({ limit: '100kb' }));

  // liveness: процес живий (Render перезапускає, якщо ні)
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: info.version });
  });
  // readiness (spec-lab4 AC20): blue-green — трафік лише на готовий інстанс
  app.get('/health/ready', async (_req, res) => {
    const { ready, checks } = await container.readiness();
    res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready', checks });
  });
  // spec-lab4 AC19: яку саме версію задеплоєно (потрібно й у завданні 5)
  app.get('/version', (_req, res) => {
    res.json({ sha: info.gitSha, version: info.version, startedAt });
  });

  // spec-lab5 AC24: RAM і затримка event loop (для аналізу «CPU чи очікування»)
  app.get('/metrics', metricsHandler);

  app.use('/teams', createTeamsRouter(services.teams));
  app.use('/tournaments', createTournamentsRouter(services.tournaments));
  app.use('/', createMatchesRouter(services.matches));
  app.use('/', createStandingsRouter(services.standings));

  app.use((_req, res) => {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Route not found' });
  });
  app.use(errorHandler);
  return app;
};
