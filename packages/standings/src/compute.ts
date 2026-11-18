import type { PointsRules, StandingRow, TournamentSnapshot } from './contract.js';

export const DEFAULT_POINTS: PointsRules = Object.freeze({ win: 3, draw: 1, loss: 0 });

type MutableRow = { -readonly [K in keyof StandingRow]: StandingRow[K] };

/**
 * S4: турнірна таблиця. Чиста функція.
 * Сортування: очки → різниця м'ячів → забиті → назва.
 */
export const computeStandings = (
  { teams, results }: TournamentSnapshot,
  rules: PointsRules = DEFAULT_POINTS,
): StandingRow[] => {
  const rows = new Map<string, MutableRow>(
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

  const apply = (teamId: string, scored: number, conceded: number): void => {
    const row = rows.get(teamId);
    if (!row) throw new Error(`Result references unknown team ${teamId}`);
    row.played += 1;
    row.goalsFor += scored;
    row.goalsAgainst += conceded;
    row.goalDiff = row.goalsFor - row.goalsAgainst;
    if (scored > conceded) {
      row.won += 1;
      row.points += rules.win;
    } else if (scored === conceded) {
      row.drawn += 1;
      row.points += rules.draw;
    } else {
      row.lost += 1;
      row.points += rules.loss;
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
