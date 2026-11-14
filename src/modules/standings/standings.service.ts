import type { Id } from '../../shared/index.js';
import type { MatchesService } from '../matches/index.js';
import type { TeamsService } from '../teams/index.js';
import type { TournamentsService } from '../tournaments/index.js';
import { computeStandings, type FinishedResult, type StandingRow } from './standings.domain.js';

export interface StandingsService {
  getStandings(tournamentId: Id): Promise<StandingRow[]>;
}

export const createStandingsService = (
  tournaments: TournamentsService,
  teams: TeamsService,
  matches: MatchesService,
): StandingsService => ({
  async getStandings(tournamentId) {
    await tournaments.get(tournamentId);
    const teamIds = await tournaments.listTeamIds(tournamentId);
    // D9: один запит замість Promise.all(getTeam) — N+1
    const teamList = await teams.getTeamsByIds(teamIds);
    const results: FinishedResult[] = (await matches.listFinished(tournamentId)).map((m) => ({
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      homeGoals: m.homeGoals,
      awayGoals: m.awayGoals,
    }));
    return computeStandings(teamList, results);
  },
});
