import type { Id } from '../../shared/index.js';

export type TournamentStatus = 'registration' | 'in_progress' | 'finished';

export interface Tournament {
  readonly id: Id;
  readonly name: string;
  readonly status: TournamentStatus;
  readonly startsOn: string; // ISO date
  /** ініціатор створення; лише він стартує турнір і вносить результати (spec-lab2 §2) */
  readonly organizerId: string;
}

export interface TournamentEntry {
  readonly tournamentId: Id;
  readonly teamId: Id;
  readonly registeredAt: string; // ISO datetime
}

const NEXT_STATUS: Record<TournamentStatus, TournamentStatus | undefined> = {
  registration: 'in_progress',
  in_progress: 'finished',
  finished: undefined,
};

/** Інваріант spec §4: статус змінюється лише вперед. */
export const canTransition = (from: TournamentStatus, to: TournamentStatus): boolean =>
  NEXT_STATUS[from] === to;
