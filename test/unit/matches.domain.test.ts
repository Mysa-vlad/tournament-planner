import { describe, expect, test } from 'vitest';
import { generateRoundRobin } from '../../src/modules/matches/index.js';

const ids = (n: number): string[] => Array.from({ length: n }, (_, i) => `t${String(i)}`);
const pairKey = (a: string, b: string): string => [a, b].sort().join('-');

describe('generateRoundRobin (S2)', () => {
  test.each([2, 3, 4, 5, 8])(
    'N=%i: N·(N−1)/2 матчів, кожна пара рівно раз, без самих із собою',
    (n) => {
      const pairings = generateRoundRobin(ids(n));
      expect(pairings).toHaveLength((n * (n - 1)) / 2);
      const keys = pairings.map((p) => pairKey(p.homeTeamId, p.awayTeamId));
      expect(new Set(keys).size).toBe(keys.length);
      expect(pairings.every((p) => p.homeTeamId !== p.awayTeamId)).toBe(true);
    },
  );

  test('кількість турів: N−1 для парного, N для непарного', () => {
    const rounds = (n: number): number =>
      new Set(generateRoundRobin(ids(n)).map((p) => p.round)).size;
    expect(rounds(4)).toBe(3);
    expect(rounds(5)).toBe(5);
  });

  test('0 або 1 команда — порожній розклад', () => {
    expect(generateRoundRobin([])).toEqual([]);
    expect(generateRoundRobin(['solo'])).toEqual([]);
  });

  test('дублікати id — помилка', () => {
    expect(() => generateRoundRobin(['a', 'b', 'a'])).toThrow(/unique/);
  });
});
