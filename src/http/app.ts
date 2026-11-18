import express, { type Express } from 'express';
import type { AppConfig } from '../config/env.js';
import {
  createInMemoryMatchesRepository,
  createMatchesRouter,
  createMatchesService,
} from '../modules/matches/index.js';
import { createStandingsRouter, createStandingsService } from '../modules/standings/index.js';
import {
  createInMemoryTeamsRepository,
  createTeamsRouter,
  createTeamsService,
} from '../modules/teams/index.js';
import {
  createInMemoryTournamentsRepository,
  createTournamentsRouter,
  createTournamentsService,
} from '../modules/tournaments/index.js';
import { errorHandler } from './error-handler.js';

/** Composition root: тут і лише тут модулі з'єднуються між собою (ручний DI). */
export const createApp = (config: AppConfig): Express => {
  // порядок створення = напрям графа залежностей spec §3 (D4): teams → tournaments → matches → standings
  const teams = createTeamsService(createInMemoryTeamsRepository());
  const tournaments = createTournamentsService(createInMemoryTournamentsRepository(), teams);
  const matches = createMatchesService(createInMemoryMatchesRepository(), tournaments, teams);
  const standings = createStandingsService(tournaments, teams, matches);

  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: config.version });
  });

  app.use('/teams', createTeamsRouter(teams));
  app.use('/tournaments', createTournamentsRouter(tournaments));
  app.use('/', createMatchesRouter(matches));
  app.use('/', createStandingsRouter(standings));

  app.use(errorHandler);
  return app;
};
