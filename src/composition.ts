import { createMemoryCache, type StandingsSource } from '@tournament-planner/standings';
import { DEFAULT_STANDINGS_TTL_MS, type AppConfig } from './config/env.js';
import {
  createDatabase,
  createPgUnitOfWork,
  isPostgresUrl,
  migrate,
  schemaStatus,
  sql,
} from './db/index.js';
import {
  createInMemoryMatchesRepository,
  createMatchesService,
  createPgMatchesRepository,
  type MatchesRepository,
  type MatchesService,
} from './modules/matches/index.js';
import {
  createPgStandingsSource,
  createServicesStandingsSource,
  createStandingsService,
  type StandingsService,
} from './modules/standings/index.js';
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

export interface Readiness {
  readonly ready: boolean;
  readonly checks: Readonly<Record<string, string>>;
}

export interface Container {
  readonly services: Services;
  /** spec-lab4 AC20: чи можна пускати трафік на цей інстанс (blue-green) */
  readiness(): Promise<Readiness>;
  /** звільнити ресурси (з'єднання з БД) під час graceful shutdown */
  close(): Promise<void>;
}

interface Infrastructure {
  readonly teamsRepo: TeamsRepository;
  readonly tournamentsRepo: TournamentsRepository;
  readonly matchesRepo: MatchesRepository;
  readonly uow: UnitOfWork;
  /** spec-lab5: read model таблиці на PostgreSQL; без нього — джерело через сервіси */
  readonly standingsSource?: StandingsSource;
  readiness(): Promise<Readiness>;
  close(): Promise<void>;
}

const staticInfrastructure = (): Infrastructure => ({
  teamsRepo: createInMemoryTeamsRepository(staticTeams),
  tournamentsRepo: createInMemoryTournamentsRepository(staticTournaments),
  matchesRepo: createInMemoryMatchesRepository(staticMatches),
  uow: passthroughUnitOfWork,
  readiness: () => Promise.resolve({ ready: true, checks: { dataSource: 'static' } }),
  close: () => Promise.resolve(),
});

const pgInfrastructure = async (databaseUrl: string): Promise<Infrastructure> => {
  // AC8: createDatabase робить SELECT now() і кидає помилку, якщо БД недоступна
  const db = await createDatabase(databaseUrl);
  // spec-lab4 AC21: на PostgreSQL-сервері міграції — окремий крок CD, не старт застосунку
  // (інакше довга міграція → таймаут старту → рестарт → цикл). Вбудований PGlite мігрує сам.
  if (!isPostgresUrl(databaseUrl)) await migrate(db);

  const readiness = async (): Promise<Readiness> => {
    try {
      await db.query(sql`SELECT 1`);
      const schema = await schemaStatus(db);
      return {
        ready: schema.upToDate,
        checks: {
          database: 'ok',
          schema: schema.upToDate
            ? `ok (${schema.applied ?? 'none'})`
            : `behind: applied ${schema.applied ?? 'none'}, expected ${schema.expected ?? 'none'}`,
        },
      };
    } catch {
      return { ready: false, checks: { database: 'unavailable' } };
    }
  };

  return {
    readiness,
    teamsRepo: createPgTeamsRepository(db),
    tournamentsRepo: createPgTournamentsRepository(db),
    matchesRepo: createPgMatchesRepository(db),
    uow: createPgUnitOfWork(db),
    standingsSource: createPgStandingsSource(db),
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
  const baseTournaments = createTournamentsService(infra.tournamentsRepo, teams);
  const baseMatches = createMatchesService({
    repo: infra.matchesRepo,
    tournaments: baseTournaments,
    teams,
    uow: infra.uow,
  });
  // spec-lab5 AC28: залежності пакета таблиці (джерело, кеш, годинник) — тут, а не в пакеті
  const standings = createStandingsService({
    source:
      infra.standingsSource ?? createServicesStandingsSource(baseTournaments, teams, baseMatches),
    cache: createMemoryCache(),
    ttlMs: config.standingsCacheTtlMs ?? DEFAULT_STANDINGS_TTL_MS,
  });
  // spec-lab5 AC30: записи, що змінюють таблицю, скидають її кеш (після успіху/коміту).
  // Модулі tournaments і matches про standings не знають (D4) — зв'язок лише тут.
  const tournaments: TournamentsService = {
    ...baseTournaments,
    async registerTeam(tournamentId, teamId) {
      const result = await baseTournaments.registerTeam(tournamentId, teamId);
      standings.invalidate(tournamentId);
      return result;
    },
  };
  const matches: MatchesService = {
    ...baseMatches,
    async recordResult(matchId, homeGoals, awayGoals) {
      const match = await baseMatches.recordResult(matchId, homeGoals, awayGoals);
      standings.invalidate(match.tournamentId);
      return match;
    },
  };
  return {
    services: { teams, tournaments, matches, standings },
    readiness: () => infra.readiness(),
    close: () => infra.close(),
  };
};
