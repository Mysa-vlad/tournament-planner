import type { Id } from '../../shared/index.js';

/** Мінімальний вхід — лише те, що потрібно для таблиці (не весь Match). */
export interface FinishedResult {
  readonly homeTeamId: Id;
  readonly awayTeamId: Id;
  readonly homeGoals: number;
  readonly awayGoals: number;
}

export interface StandingRow {
  readonly teamId: Id;
  readonly teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
}

export const POINTS = { win: 3, draw: 1, loss: 0 } as const;

/**
 * S4: турнірна таблиця. Чиста функція (AC6).
 * Сортування: очки → різниця м'ячів → забиті → назва.
 */
export const computeStandings = (
  teams: readonly { id: Id; name: string }[],
  results: readonly FinishedResult[],
): StandingRow[] => {
  const rows = new Map<Id, StandingRow>(
    teams.map((t) => [
      t.id,
      {
        teamId: t.id,
        teamName: t.name,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDiff: 0,
        points: 0,
      },
    ]),
  );

  const apply = (teamId: Id, scored: number, conceded: number): void => {
    const row = rows.get(teamId);
    if (!row) throw new Error(`Result references unknown team ${teamId}`);
    row.played += 1;
    row.goalsFor += scored;
    row.goalsAgainst += conceded;
    row.goalDiff = row.goalsFor - row.goalsAgainst;
    if (scored > conceded) {
      row.won += 1;
      row.points += POINTS.win;
    } else if (scored === conceded) {
      row.drawn += 1;
      row.points += POINTS.draw;
    } else {
      row.lost += 1;
      row.points += POINTS.loss;
    }
  };

  for (const r of results) {
    apply(r.homeTeamId, r.homeGoals, r.awayGoals);
    apply(r.awayTeamId, r.awayGoals, r.homeGoals);
  }

  return [...rows.values()].sort(
    (a, b) =>
      b.points - a.points ||
      b.goalDiff - a.goalDiff ||
      b.goalsFor - a.goalsFor ||
      a.teamName.localeCompare(b.teamName),
  );
};
