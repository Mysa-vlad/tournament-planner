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

/** Завершений матч: рахунок гарантовано є (інваріант CHECK у БД, spec-lab2 §3). */
export type FinishedMatch = Match & {
  readonly status: 'finished';
  readonly homeGoals: number;
  readonly awayGoals: number;
};

export const isFinished = (m: Match): m is FinishedMatch =>
  m.status === 'finished' && m.homeGoals !== null && m.awayGoals !== null;

export interface Pairing {
  readonly round: number;
  readonly homeTeamId: Id;
  readonly awayTeamId: Id;
}

/** «Вихідний» слот для непарного N; undefined, тож збігається з виходом за межі масиву. */
const BYE = undefined;

/**
 * S2: кругова система (circle method). Чиста функція (AC6).
 * N команд → N·(N−1)/2 пар; для непарного N одна команда в турі відпочиває.
 */
export const generateRoundRobin = (teamIds: readonly Id[]): Pairing[] => {
  if (new Set(teamIds).size !== teamIds.length) {
    throw new Error('Team ids must be unique');
  }
  const slots: (Id | typeof BYE)[] = [...teamIds];
  // BYE — у фіксованому слоті: тоді для непарного N баланс господар/гість рівно 0
  if (slots.length % 2 === 1) slots.unshift(BYE);
  const n = slots.length;
  const pairings: Pairing[] = [];

  for (let round = 0; round < n - 1; round++) {
    for (let i = 0; i < n / 2; i++) {
      const a = slots[i];
      const b = slots[n - 1 - i];
      if (a === BYE || b === BYE) continue; // команда цього туру відпочиває
      // spec S2: |домашні − виїзні| ≤ 1. Фіксований слот (i = 0) чергується за туром,
      // решта пар — за парністю позиції; разом з обертанням це дає оптимальний баланс.
      const aIsHome = i === 0 ? round % 2 === 0 : i % 2 === 1;
      const [homeTeamId, awayTeamId] = aIsHome ? [a, b] : [b, a];
      pairings.push({ round: round + 1, homeTeamId, awayTeamId });
    }
    // фіксуємо перший слот, решту обертаємо
    slots.splice(1, 0, ...slots.splice(-1));
  }
  return pairings;
};
