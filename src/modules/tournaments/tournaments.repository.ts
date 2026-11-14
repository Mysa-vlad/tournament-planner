import type { Id } from '../../shared/index.js';
import type { Tournament, TournamentEntry } from './tournaments.domain.js';

/** Контракт сховища. Завдання 2 додасть реалізацію з БД. */
export interface TournamentsRepository {
  findById(id: Id): Promise<Tournament | undefined>;
  list(): Promise<Tournament[]>;
  save(tournament: Tournament): Promise<void>;
  listEntries(tournamentId: Id): Promise<TournamentEntry[]>;
  listEntriesByTeam(teamId: Id): Promise<TournamentEntry[]>;
  saveEntry(entry: TournamentEntry): Promise<void>;
}

export const createInMemoryTournamentsRepository = (): TournamentsRepository => {
  const tournaments = new Map<Id, Tournament>();
  const entries: TournamentEntry[] = [];
  return {
    findById: (id) => Promise.resolve(tournaments.get(id)),
    list: () => Promise.resolve([...tournaments.values()]),
    save: (t) => {
      tournaments.set(t.id, t);
      return Promise.resolve();
    },
    listEntries: (tournamentId) =>
      Promise.resolve(entries.filter((e) => e.tournamentId === tournamentId)),
    listEntriesByTeam: (teamId) => Promise.resolve(entries.filter((e) => e.teamId === teamId)),
    saveEntry: (entry) => {
      entries.push(entry);
      return Promise.resolve();
    },
  };
};
