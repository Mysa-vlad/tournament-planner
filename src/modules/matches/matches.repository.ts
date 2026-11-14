import type { Id } from '../../shared/index.js';
import type { Match } from './matches.domain.js';

/** Контракт сховища: реалізації — in-memory (прототип) і PostgreSQL. */
export interface MatchesRepository {
  findById(id: Id): Promise<Match | undefined>;
  listByTournament(tournamentId: Id): Promise<Match[]>;
  insertMany(matches: readonly Match[]): Promise<void>;
  /** S3: compare-and-set; повертає оновлений матч або undefined, якщо він уже не `scheduled` */
  finishIfScheduled(id: Id, homeGoals: number, awayGoals: number): Promise<Match | undefined>;
  countUnfinished(tournamentId: Id): Promise<number>;
}

export const createInMemoryMatchesRepository = (seed: readonly Match[] = []): MatchesRepository => {
  const matches = new Map<Id, Match>(seed.map((m) => [m.id, m]));
  const byTournament = (tournamentId: Id): Match[] =>
    [...matches.values()]
      .filter((m) => m.tournamentId === tournamentId)
      .sort((a, b) => a.round - b.round);
  return {
    findById: (id) => Promise.resolve(matches.get(id)),
    listByTournament: (tournamentId) => Promise.resolve(byTournament(tournamentId)),
    insertMany: (list) => {
      for (const m of list) matches.set(m.id, m);
      return Promise.resolve();
    },
    finishIfScheduled: (id, homeGoals, awayGoals) => {
      const m = matches.get(id);
      if (m?.status !== 'scheduled') return Promise.resolve(undefined);
      const finished: Match = { ...m, status: 'finished', homeGoals, awayGoals };
      matches.set(id, finished);
      return Promise.resolve(finished);
    },
    countUnfinished: (tournamentId) =>
      Promise.resolve(byTournament(tournamentId).filter((m) => m.status !== 'finished').length),
  };
};
