import type { Id } from '../../shared/index.js';
import type { Tournament, TournamentEntry, TournamentStatus } from './tournaments.domain.js';

/** Контракт сховища: реалізації — in-memory (прототип) і PostgreSQL. */
export interface TournamentsRepository {
  findById(id: Id): Promise<Tournament | undefined>;
  list(): Promise<Tournament[]>;
  insert(tournament: Tournament): Promise<void>;
  listEntries(tournamentId: Id): Promise<TournamentEntry[]>;
  /** S1, ідемпотентно: повертає наявну заявку, якщо вона вже є (created = false) */
  insertEntryIfAbsent(
    entry: TournamentEntry,
  ): Promise<{ entry: TournamentEntry; created: boolean }>;
  /**
   * Умовний перехід статусу (compare-and-set): true, лише якщо статус був `from`.
   * Захищає від гонки двох паралельних стартів (AC9).
   */
  transitionStatus(id: Id, from: TournamentStatus, to: TournamentStatus): Promise<boolean>;
}

export interface TournamentsSeed {
  readonly tournaments: readonly Tournament[];
  readonly entries: readonly TournamentEntry[];
}

export const createInMemoryTournamentsRepository = (
  seed: TournamentsSeed = { tournaments: [], entries: [] },
): TournamentsRepository => {
  const tournaments = new Map<Id, Tournament>(seed.tournaments.map((t) => [t.id, t]));
  const entries: TournamentEntry[] = [...seed.entries];
  return {
    findById: (id) => Promise.resolve(tournaments.get(id)),
    list: () => Promise.resolve([...tournaments.values()]),
    insert: (t) => {
      tournaments.set(t.id, t);
      return Promise.resolve();
    },
    listEntries: (tournamentId) =>
      Promise.resolve(entries.filter((e) => e.tournamentId === tournamentId)),
    insertEntryIfAbsent: (entry) => {
      const existing = entries.find(
        (e) => e.tournamentId === entry.tournamentId && e.teamId === entry.teamId,
      );
      if (existing) return Promise.resolve({ entry: existing, created: false });
      entries.push(entry);
      return Promise.resolve({ entry, created: true });
    },
    transitionStatus: (id, from, to) => {
      const t = tournaments.get(id);
      if (t?.status !== from) return Promise.resolve(false);
      tournaments.set(id, { ...t, status: to });
      return Promise.resolve(true);
    },
  };
};
