import { describe, expect, test } from 'vitest';
import {
  computeStandings,
  POINTS,
  type FinishedResult,
} from '../../src/modules/standings/index.js';

const teams = [
  { id: 'a', name: 'Alpha' },
  { id: 'b', name: 'Bravo' },
  { id: 'c', name: 'Charlie' },
];
const r = (home: string, away: string, hg: number, ag: number): FinishedResult => ({
  homeTeamId: home,
  awayTeamId: away,
  homeGoals: hg,
  awayGoals: ag,
});

describe('computeStandings (S4)', () => {
  test('без результатів: усі команди з нулями, сортування за назвою', () => {
    const table = computeStandings(teams, []);
    expect(table.map((row) => row.teamName)).toEqual(['Alpha', 'Bravo', 'Charlie']);
    expect(table.every((row) => row.played === 0 && row.points === 0)).toBe(true);
  });

  test('перемога 3, нічия 1, поразка 0', () => {
    expect(POINTS).toEqual({ win: 3, draw: 1, loss: 0 });
    const table = computeStandings(teams, [r('a', 'b', 2, 0), r('b', 'c', 1, 1)]);
    const byId = Object.fromEntries(table.map((row) => [row.teamId, row]));
    expect(byId.a).toMatchObject({ played: 1, won: 1, points: 3, goalsFor: 2, goalsAgainst: 0 });
    expect(byId.b).toMatchObject({ played: 2, drawn: 1, lost: 1, points: 1, goalDiff: -2 });
    expect(byId.c).toMatchObject({ played: 1, drawn: 1, points: 1 });
  });

  test('сортування: очки → різниця м’ячів', () => {
    const table = computeStandings(teams, [r('a', 'c', 1, 0), r('b', 'c', 3, 0)]);
    expect(table.map((row) => row.teamId)).toEqual(['b', 'a', 'c']);
  });

  test('результат із невідомою командою — помилка', () => {
    expect(() => computeStandings(teams, [r('a', 'zzz', 1, 0)])).toThrow(/unknown team zzz/);
  });
});

describe('тай-брейки S4 (T6): очки → різниця → забиті → назва', () => {
  test('рівні очки й різниця: вище той, хто більше забив', () => {
    // a: 3:2 проти c (+1, 3 забиті); b: 1:0 проти c (+1, 1 забитий) — очки й різниця рівні
    const table = computeStandings(teams, [r('a', 'c', 3, 2), r('b', 'c', 1, 0)]);
    expect(table.map((row) => row.teamId)).toEqual(['a', 'b', 'c']);
    // дзеркально: якщо Bravo забив більше — Bravo вище, незважаючи на алфавіт
    const mirrored = computeStandings(teams, [r('a', 'c', 1, 0), r('b', 'c', 3, 2)]);
    expect(mirrored.map((row) => row.teamId)).toEqual(['b', 'a', 'c']);
  });

  test('усе рівне → за назвою; рахунки поразок і нічиїх додаються коректно', () => {
    const table = computeStandings(
      [
        { id: 'z', name: 'Zorya' },
        { id: 'y', name: 'Arsenal' },
      ],
      [r('z', 'y', 1, 1)],
    );
    expect(table.map((row) => row.teamName)).toEqual(['Arsenal', 'Zorya']);
    const loss = computeStandings(teams, [r('a', 'b', 0, 2)]).find((row) => row.teamId === 'a');
    expect(loss).toMatchObject({ lost: 1, points: 0, goalsFor: 0, goalsAgainst: 2, goalDiff: -2 });
  });
});

describe('очки важливіші за різницю м’ячів (T6)', () => {
  test('більше очок, але гірша різниця → все одно вище', () => {
    const four = [...teams, { id: 'd', name: 'Delta' }];
    // a: перемога 1:0 і поразка 0:5 → 3 очки, різниця −4; b: нічия 0:0 → 1 очко, різниця 0
    const table = computeStandings(four, [r('a', 'c', 1, 0), r('d', 'a', 5, 0), r('b', 'c', 0, 0)]);
    const pos = (id: string): number => table.findIndex((row) => row.teamId === id);
    expect(pos('a')).toBeLessThan(pos('b'));
  });
});
