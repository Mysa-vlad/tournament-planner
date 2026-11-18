import type { Id } from '../../shared/index.js';

export type MatchStatus = 'scheduled' | 'finished';

export interface Match {
  readonly id: Id;
  readonly tournamentId: Id;
  readonly round: number;
  readonly homeTeamId: Id;
  readonly awayTeamId: Id;
  readonly status: MatchStatus;
  readonly homeGoals: number | null;
  readonly awayGoals: number | null;
}

export interface Pairing {
  readonly round: number;
  readonly homeTeamId: Id;
  readonly awayTeamId: Id;
}

const BYE = null;

/**
 * S2: кругова система (circle method). Чиста функція (AC6).
 * N команд → N·(N−1)/2 пар; для непарного N одна команда в турі відпочиває.
 */
export const generateRoundRobin = (teamIds: readonly Id[]): Pairing[] => {
  if (new Set(teamIds).size !== teamIds.length) {
    throw new Error('Team ids must be unique');
  }
  const slots: (Id | typeof BYE)[] = [...teamIds];
  if (slots.length % 2 === 1) slots.push(BYE);
  const n = slots.length;
  const pairings: Pairing[] = [];

  for (let round = 0; round < n - 1; round++) {
    for (let i = 0; i < n / 2; i++) {
      const a = slots[i];
      const b = slots[n - 1 - i];
      if (a === BYE || b === BYE || a === undefined || b === undefined) continue;
      // чергуємо господарів, щоб у команди не було всіх матчів удома
      const [homeTeamId, awayTeamId] = round % 2 === 0 ? [a, b] : [b, a];
      pairings.push({ round: round + 1, homeTeamId, awayTeamId });
    }
    // фіксуємо перший слот, решту обертаємо
    const last = slots.pop();
    if (last !== undefined) slots.splice(1, 0, last);
  }
  return pairings;
};
