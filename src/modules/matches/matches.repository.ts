import type { Id } from '../../shared/index.js';
import type { Match } from './matches.domain.js';

/** Контракт сховища. Завдання 2 додасть реалізацію з БД. */
export interface MatchesRepository {
  findById(id: Id): Promise<Match | undefined>;
  listByTournament(tournamentId: Id): Promise<Match[]>;
  saveMany(matches: readonly Match[]): Promise<void>;
  save(match: Match): Promise<void>;
}

export const createInMemoryMatchesRepository = (): MatchesRepository => {
  const matches = new Map<Id, Match>();
  return {
    findById: (id) => Promise.resolve(matches.get(id)),
    listByTournament: (tournamentId) =>
      Promise.resolve(
        [...matches.values()]
          .filter((m) => m.tournamentId === tournamentId)
          .sort((a, b) => a.round - b.round),
      ),
    saveMany: (list) => {
      for (const m of list) matches.set(m.id, m);
      return Promise.resolve();
    },
    save: (m) => {
      matches.set(m.id, m);
      return Promise.resolve();
    },
  };
};
