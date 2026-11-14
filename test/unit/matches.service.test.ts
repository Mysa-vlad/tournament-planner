import { beforeEach, describe, expect, test } from 'vitest';
import { as, makeServices, ORG, tournamentWithTeams, type Services } from './fixtures.js';

describe('MatchesService', () => {
  let s: Services;
  beforeEach(() => {
    s = makeServices();
  });

  describe('startTournament (S2)', () => {
    test('організатор стартує: розклад створено, статус in_progress', async () => {
      const { tournamentId } = await tournamentWithTeams(s, 4);
      const { matches, created } = await as(ORG, () => s.matches.startTournament(tournamentId));
      expect(created).toBe(true);
      expect(matches).toHaveLength(6);
      expect(matches.every((m) => m.status === 'scheduled' && m.homeGoals === null)).toBe(true);
      expect((await s.tournaments.get(tournamentId)).status).toBe('in_progress');
    });

    test('не організатор → FORBIDDEN; без користувача → UNAUTHENTICATED', async () => {
      const { tournamentId } = await tournamentWithTeams(s, 2);
      await expect(as('bob', () => s.matches.startTournament(tournamentId))).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      await expect(
        as(undefined, () => s.matches.startTournament(tournamentId)),
      ).rejects.toMatchObject({
        code: 'UNAUTHENTICATED',
      });
    });

    test('менше 2 команд → CONFLICT', async () => {
      const { tournamentId } = await tournamentWithTeams(s, 1);
      await expect(as(ORG, () => s.matches.startTournament(tournamentId))).rejects.toMatchObject({
        code: 'CONFLICT',
      });
    });

    test('повтор → той самий розклад, created = false (AC9)', async () => {
      const { tournamentId } = await tournamentWithTeams(s, 3);
      const first = await as(ORG, () => s.matches.startTournament(tournamentId));
      const again = await as(ORG, () => s.matches.startTournament(tournamentId));
      expect(again.created).toBe(false);
      expect(again.matches.map((m) => m.id).sort()).toEqual(first.matches.map((m) => m.id).sort());
    });
  });

  describe('recordResult (S3 + S5)', () => {
    const started = async (n: number): Promise<{ tournamentId: string; matchIds: string[] }> => {
      const { tournamentId } = await tournamentWithTeams(s, n);
      const { matches } = await as(ORG, () => s.matches.startTournament(tournamentId));
      return { tournamentId, matchIds: matches.map((m) => m.id) };
    };

    test('результат записано, повтор того самого → той самий матч', async () => {
      const { matchIds } = await started(3);
      const id = matchIds[0] ?? '';
      const m = await as(ORG, () => s.matches.recordResult(id, 2, 1));
      expect(m).toMatchObject({ status: 'finished', homeGoals: 2, awayGoals: 1 });
      await expect(as(ORG, () => s.matches.recordResult(id, 2, 1))).resolves.toMatchObject({ id });
    });

    test('інший рахунок для завершеного матчу → CONFLICT', async () => {
      const { matchIds } = await started(3);
      const id = matchIds[0] ?? '';
      await as(ORG, () => s.matches.recordResult(id, 2, 1));
      await expect(as(ORG, () => s.matches.recordResult(id, 0, 0))).rejects.toMatchObject({
        code: 'CONFLICT',
      });
    });

    test('неіснуючий матч → NOT_FOUND', async () => {
      await expect(
        as(ORG, () => s.matches.recordResult('00000000-0000-4000-8000-000000000000', 1, 0)),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    test('останній результат завершує турнір (S5)', async () => {
      const { tournamentId, matchIds } = await started(2);
      await as(ORG, () => s.matches.recordResult(matchIds[0] ?? '', 0, 0));
      expect((await s.tournaments.get(tournamentId)).status).toBe('finished');
    });
  });

  test('getSchedule: матчі з назвами команд', async () => {
    const { tournamentId } = await tournamentWithTeams(s, 2);
    await as(ORG, () => s.matches.startTournament(tournamentId));
    const schedule = await s.matches.getSchedule(tournamentId);
    expect(schedule).toHaveLength(1);
    expect(schedule[0]?.homeTeamName).toMatch(/^Team /);
  });
});
