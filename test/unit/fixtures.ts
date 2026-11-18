import {
  createInMemoryMatchesRepository,
  createMatchesService,
  type MatchesRepository,
  type MatchesService,
} from '../../src/modules/matches/index.js';
import {
  createServicesStandingsSource,
  createStandingsService,
  type StandingsService,
} from '../../src/modules/standings/index.js';
import {
  createInMemoryTeamsRepository,
  createTeamsService,
  type TeamsRepository,
  type TeamsService,
} from '../../src/modules/teams/index.js';
import {
  createInMemoryTournamentsRepository,
  createTournamentsService,
  type TournamentsRepository,
  type TournamentsService,
} from '../../src/modules/tournaments/index.js';
import {
  passthroughUnitOfWork,
  runWithContext,
  type RequestContext,
  type UnitOfWork,
} from '../../src/shared/index.js';

export interface Services {
  readonly repos: {
    readonly teams: TeamsRepository;
    readonly tournaments: TournamentsRepository;
    readonly matches: MatchesRepository;
  };
  readonly teams: TeamsService;
  readonly tournaments: TournamentsService;
  readonly matches: MatchesService;
  readonly standings: StandingsService;
}

/** Сервіси на in-memory репозиторіях: unit-рівень без БД і HTTP. */
export const makeServices = (uow: UnitOfWork = passthroughUnitOfWork): Services => {
  const repos = {
    teams: createInMemoryTeamsRepository(),
    tournaments: createInMemoryTournamentsRepository(),
    matches: createInMemoryMatchesRepository(),
  };
  const teams = createTeamsService(repos.teams);
  const tournaments = createTournamentsService(repos.tournaments, teams);
  const matches = createMatchesService({ repo: repos.matches, tournaments, teams, uow });
  const standings = createStandingsService({
    source: createServicesStandingsSource(tournaments, teams, matches),
  });
  return { repos, teams, tournaments, matches, standings };
};

/** Виконати від імені користувача (request-контекст як у HTTP-запиті). */
export const as = <T>(userId: string | undefined, fn: () => Promise<T>): Promise<T> => {
  const ctx: RequestContext = { requestId: 'unit-test', userId, queryCount: 0 };
  return runWithContext(ctx, fn);
};

export const ORG = 'organizer';

/** Турнір у статусі registration із N заявленими командами. */
export const tournamentWithTeams = async (
  s: Services,
  n: number,
): Promise<{ tournamentId: string; teamIds: string[] }> =>
  as(ORG, async () => {
    const t = await s.tournaments.create({ name: 'Cup', startsOn: '2026-12-01' });
    const teamIds: string[] = [];
    for (let i = 0; i < n; i++) {
      const team = await s.teams.createTeam({ name: `Team ${String(i)}`, city: '' });
      await s.tournaments.registerTeam(t.id, team.id);
      teamIds.push(team.id);
    }
    return { tournamentId: t.id, teamIds };
  });
