import express, { type Express } from 'express';
import type { Services } from '../composition.js';
import { createMatchesRouter } from '../modules/matches/index.js';
import { createStandingsRouter } from '../modules/standings/index.js';
import { createTeamsRouter } from '../modules/teams/index.js';
import { createTournamentsRouter } from '../modules/tournaments/index.js';
import { contextMiddleware } from './context-middleware.js';
import { errorHandler } from './error-handler.js';

/** HTTP-рівень: знає лише про маршрути й формат; сервіси приходять готовими з composition root. */
export const createApp = (services: Services, info: { version: string }): Express => {
  const app = express();
  app.disable('x-powered-by');
  app.use(contextMiddleware);
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: info.version });
  });

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
