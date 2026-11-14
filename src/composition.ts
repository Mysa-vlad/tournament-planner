import type { AppConfig } from './config/env.js';
import {
  createInMemoryMatchesRepository,
  createMatchesService,
  type MatchesService,
} from './modules/matches/index.js';
import { createStandingsService, type StandingsService } from './modules/standings/index.js';
import {
  createInMemoryTeamsRepository,
  createTeamsService,
  type TeamsService,
} from './modules/teams/index.js';
import {
  createInMemoryTournamentsRepository,
  createTournamentsService,
  type TournamentsService,
} from './modules/tournaments/index.js';
import { staticMatches, staticTeams, staticTournaments } from './prototype/static-data.js';
import { passthroughUnitOfWork } from './shared/index.js';

export interface Services {
  readonly teams: TeamsService;
  readonly tournaments: TournamentsService;
  readonly matches: MatchesService;
  readonly standings: StandingsService;
}

export interface Container {
  readonly services: Services;
  /** звільнити ресурси (з'єднання з БД) під час graceful shutdown */
  close(): Promise<void>;
}

/**
 * Composition root (ADR 0005): ресурси створюються й ініціалізуються ОДИН раз на старті
 * і передаються в модулі через фабрики. Порядок = граф залежностей spec §3 (D4).
 */
export const createContainer = (config: AppConfig): Promise<Container> => {
  if (config.dataSource !== 'static') {
    return Promise.reject(new Error(`DATA_SOURCE=${config.dataSource} is not implemented yet`));
  }
  const teams = createTeamsService(createInMemoryTeamsRepository(staticTeams));
  const tournaments = createTournamentsService(
    createInMemoryTournamentsRepository(staticTournaments),
    teams,
  );
  const matches = createMatchesService({
    repo: createInMemoryMatchesRepository(staticMatches),
    tournaments,
    teams,
    uow: passthroughUnitOfWork,
  });
  const standings = createStandingsService(tournaments, teams, matches);
  return Promise.resolve({
    services: { teams, tournaments, matches, standings },
    close: () => Promise.resolve(),
  });
};
