import type { AppConfig } from './config/env.js';
import { createDatabase, createPgUnitOfWork, migrate } from './db/index.js';
import {
  createInMemoryMatchesRepository,
  createMatchesService,
  createPgMatchesRepository,
  type MatchesRepository,
  type MatchesService,
} from './modules/matches/index.js';
import { createStandingsService, type StandingsService } from './modules/standings/index.js';
import {
  createInMemoryTeamsRepository,
  createPgTeamsRepository,
  createTeamsService,
  type TeamsRepository,
  type TeamsService,
} from './modules/teams/index.js';
import {
  createInMemoryTournamentsRepository,
  createPgTournamentsRepository,
  createTournamentsService,
  type TournamentsRepository,
  type TournamentsService,
} from './modules/tournaments/index.js';
import { staticMatches, staticTeams, staticTournaments } from './prototype/static-data.js';
import { passthroughUnitOfWork, type UnitOfWork } from './shared/index.js';

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

interface Infrastructure {
  readonly teamsRepo: TeamsRepository;
  readonly tournamentsRepo: TournamentsRepository;
  readonly matchesRepo: MatchesRepository;
  readonly uow: UnitOfWork;
  close(): Promise<void>;
}

const staticInfrastructure = (): Infrastructure => ({
  teamsRepo: createInMemoryTeamsRepository(staticTeams),
  tournamentsRepo: createInMemoryTournamentsRepository(staticTournaments),
  matchesRepo: createInMemoryMatchesRepository(staticMatches),
  uow: passthroughUnitOfWork,
  close: () => Promise.resolve(),
});

const pgInfrastructure = async (databaseUrl: string): Promise<Infrastructure> => {
  // AC8: createDatabase робить SELECT now() і кидає помилку, якщо БД недоступна
  const db = await createDatabase(databaseUrl);
  await migrate(db);
  return {
    teamsRepo: createPgTeamsRepository(db),
    tournamentsRepo: createPgTournamentsRepository(db),
    matchesRepo: createPgMatchesRepository(db),
    uow: createPgUnitOfWork(db),
    close: () => db.close(),
  };
};

/**
 * Composition root (ADR 0005): ресурси створюються й ініціалізуються ОДИН раз на старті
 * і передаються в модулі через фабрики. Порядок = граф залежностей spec §3 (D4).
 * Сервіси не знають, яке джерело даних під ними (AC7).
 */
export const createContainer = async (config: AppConfig): Promise<Container> => {
  const infra =
    config.dataSource === 'pg'
      ? await pgInfrastructure(config.databaseUrl)
      : staticInfrastructure();

  const teams = createTeamsService(infra.teamsRepo);
  const tournaments = createTournamentsService(infra.tournamentsRepo, teams);
  const matches = createMatchesService({
    repo: infra.matchesRepo,
    tournaments,
    teams,
    uow: infra.uow,
  });
  const standings = createStandingsService(tournaments, teams, matches);
  return { services: { teams, tournaments, matches, standings }, close: () => infra.close() };
};
