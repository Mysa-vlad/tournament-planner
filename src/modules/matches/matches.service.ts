import { DomainError, logger, newId, type Id, type UnitOfWork } from '../../shared/index.js';
import type { TeamsService } from '../teams/index.js';
import type { TournamentsService } from '../tournaments/index.js';
import {
  generateRoundRobin,
  isFinished,
  type FinishedMatch,
  type Match,
} from './matches.domain.js';
import type { MatchesRepository } from './matches.repository.js';

export interface ScheduledMatchView extends Match {
  readonly homeTeamName: string;
  readonly awayTeamName: string;
}

export interface MatchesService {
  /** S2; created = false, якщо турнір уже стартував (ідемпотентний повтор) */
  startTournament(tournamentId: Id): Promise<{ matches: Match[]; created: boolean }>;
  /** S3 + S5; повтор із тим самим рахунком — не помилка (ідемпотентність) */
  recordResult(matchId: Id, homeGoals: number, awayGoals: number): Promise<Match>;
  listFinished(tournamentId: Id): Promise<FinishedMatch[]>;
  getSchedule(tournamentId: Id): Promise<ScheduledMatchView[]>;
}

export interface MatchesDeps {
  readonly repo: MatchesRepository;
  readonly tournaments: TournamentsService;
  readonly teams: TeamsService;
  readonly uow: UnitOfWork;
}

const sameScore = (m: Match, homeGoals: number, awayGoals: number): boolean =>
  m.homeGoals === homeGoals && m.awayGoals === awayGoals;

export const createMatchesService = ({
  repo,
  tournaments,
  teams,
  uow,
}: MatchesDeps): MatchesService => ({
  // S2: старт турніру. Перехід статусу і вставка розкладу — одна атомарна операція (spec-lab2 §3).
  startTournament: (tournamentId) =>
    uow.run(async () => {
      const t = await tournaments.assertOrganizer(tournamentId);
      if (t.status !== 'registration') {
        const existing = await repo.listByTournament(tournamentId);
        if (existing.length > 0) return { matches: existing, created: false };
        throw new DomainError('CONFLICT', `Tournament is ${t.status}`);
      }
      const teamIds = await tournaments.listTeamIds(tournamentId);
      if (teamIds.length < 2) {
        throw new DomainError('CONFLICT', 'At least 2 teams are required to start');
      }
      const moved = await tournaments.tryTransition(tournamentId, 'registration', 'in_progress');
      if (!moved) {
        // паралельний старт виграв гонку — повертаємо його розклад (AC9)
        return { matches: await repo.listByTournament(tournamentId), created: false };
      }
      const matches: Match[] = generateRoundRobin(teamIds).map((p) => ({
        id: newId(),
        tournamentId,
        ...p,
        status: 'scheduled',
        homeGoals: null,
        awayGoals: null,
      }));
      await repo.insertMany(matches);
      logger.info({ tournamentId, matches: matches.length }, 'tournament started');
      return { matches, created: true };
    }),

  // S3 + S5
  recordResult: (matchId, homeGoals, awayGoals) =>
    uow.run(async () => {
      const match = await repo.findById(matchId);
      if (!match) throw new DomainError('NOT_FOUND', `Match ${matchId} not found`);
      await tournaments.assertOrganizer(match.tournamentId);

      const finished = await repo.finishIfScheduled(matchId, homeGoals, awayGoals);
      if (!finished) {
        const current = (await repo.findById(matchId)) ?? match;
        if (sameScore(current, homeGoals, awayGoals)) return current; // повтор того ж запиту
        throw new DomainError('CONFLICT', 'Match already has a different result');
      }
      if ((await repo.countUnfinished(match.tournamentId)) === 0) {
        await tournaments.tryTransition(match.tournamentId, 'in_progress', 'finished');
        logger.info({ tournamentId: match.tournamentId }, 'tournament finished');
      }
      return finished;
    }),

  async listFinished(tournamentId) {
    return (await repo.listByTournament(tournamentId)).filter(isFinished);
  },

  async getSchedule(tournamentId) {
    await tournaments.get(tournamentId);
    const matches = await repo.listByTournament(tournamentId);
    // D9: усі назви команд одним запитом (було: по запиту на команду — N+1)
    const teamList = await teams.getTeamsByIds(
      matches.flatMap((m) => [m.homeTeamId, m.awayTeamId]),
    );
    const names = new Map<Id, string>(teamList.map((t) => [t.id, t.name]));
    return matches.map((m) => ({
      ...m,
      homeTeamName: names.get(m.homeTeamId) ?? '',
      awayTeamName: names.get(m.awayTeamId) ?? '',
    }));
  },
});
