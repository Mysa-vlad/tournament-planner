import type { StandingsSource } from '@tournament-planner/standings';
import { DomainError } from '../../shared/index.js';
import type { MatchesService } from '../matches/index.js';
import type { TeamsService } from '../teams/index.js';
import type { TournamentsService } from '../tournaments/index.js';

/**
 * Джерело для DATA_SOURCE=static: дані читаються через сервіси модулів (spec D2).
 * Так само працювало джерело до spec-lab5; для PostgreSQL є read model з одним SQL.
 */
export const createServicesStandingsSource = (
  tournaments: TournamentsService,
  teams: TeamsService,
  matches: MatchesService,
): StandingsSource => ({
  async loadSnapshot(tournamentId) {
    try {
      await tournaments.get(tournamentId);
    } catch (err) {
      if (err instanceof DomainError && err.code === 'NOT_FOUND') return undefined;
      throw err;
    }
    const teamIds = await tournaments.listTeamIds(tournamentId);
    return {
      teams: await teams.getTeamsByIds(teamIds),
      results: (await matches.listFinished(tournamentId)).map((m) => ({
        homeTeamId: m.homeTeamId,
        awayTeamId: m.awayTeamId,
        homeGoals: m.homeGoals,
        awayGoals: m.awayGoals,
      })),
    };
  },
});
