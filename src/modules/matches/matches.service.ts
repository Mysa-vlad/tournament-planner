import { DomainError, newId, type Id } from '../../shared/index.js';
import type { TeamsService } from '../teams/index.js';
import type { TournamentsService } from '../tournaments/index.js';
import { generateRoundRobin, type Match } from './matches.domain.js';
import type { MatchesRepository } from './matches.repository.js';

export interface ScheduledMatchView extends Match {
  readonly homeTeamName: string;
  readonly awayTeamName: string;
}

export interface MatchesService {
  startTournament(tournamentId: Id): Promise<Match[]>;
  recordResult(matchId: Id, homeGoals: number, awayGoals: number): Promise<Match>;
  listFinished(tournamentId: Id): Promise<Match[]>;
  getSchedule(tournamentId: Id): Promise<ScheduledMatchView[]>;
}

export const createMatchesService = (
  repo: MatchesRepository,
  tournaments: TournamentsService,
  teams: TeamsService,
): MatchesService => ({
  // S2: старт турніру — генерація розкладу
  async startTournament(tournamentId) {
    const teamIds = await tournaments.listTeamIds(tournamentId);
    if (teamIds.length < 2) {
      throw new DomainError('CONFLICT', 'At least 2 teams are required to start');
    }
    await tournaments.changeStatus(tournamentId, 'in_progress');
    const matches: Match[] = generateRoundRobin(teamIds).map((p) => ({
      id: newId(),
      tournamentId,
      ...p,
      status: 'scheduled',
      homeGoals: null,
      awayGoals: null,
    }));
    await repo.saveMany(matches);
    return matches;
  },

  // S3 + S5: результат матчу і автоматичне завершення турніру
  async recordResult(matchId, homeGoals, awayGoals) {
    if (![homeGoals, awayGoals].every((g) => Number.isInteger(g) && g >= 0)) {
      throw new DomainError('VALIDATION', 'Goals must be non-negative integers');
    }
    const match = await repo.findById(matchId);
    if (!match) throw new DomainError('NOT_FOUND', `Match ${matchId} not found`);
    if (match.status !== 'scheduled') throw new DomainError('CONFLICT', 'Match already finished');

    const finished: Match = { ...match, status: 'finished', homeGoals, awayGoals };
    await repo.save(finished);

    const all = await repo.listByTournament(match.tournamentId);
    if (all.every((m) => m.status === 'finished')) {
      await tournaments.changeStatus(match.tournamentId, 'finished');
    }
    return finished;
  },

  async listFinished(tournamentId) {
    return (await repo.listByTournament(tournamentId)).filter((m) => m.status === 'finished');
  },

  async getSchedule(tournamentId) {
    const matches = await repo.listByTournament(tournamentId);
    // D2: імена команд — через публічний сервіс teams, а не через його репозиторій
    const names = new Map<Id, string>();
    for (const id of new Set(matches.flatMap((m) => [m.homeTeamId, m.awayTeamId]))) {
      names.set(id, (await teams.getTeam(id)).name);
    }
    return matches.map((m) => ({
      ...m,
      homeTeamName: names.get(m.homeTeamId) ?? '',
      awayTeamName: names.get(m.awayTeamId) ?? '',
    }));
  },
});
