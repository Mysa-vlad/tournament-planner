import { beforeEach, describe, expect, test } from 'vitest';
import { canTransition } from '../../src/modules/tournaments/tournaments.domain.js';
import { as, makeServices, ORG, tournamentWithTeams, type Services } from './fixtures.js';

describe('canTransition (інваріант статусу)', () => {
  test('лише вперед на один крок', () => {
    expect(canTransition('registration', 'in_progress')).toBe(true);
    expect(canTransition('in_progress', 'finished')).toBe(true);
    expect(canTransition('registration', 'finished')).toBe(false);
    expect(canTransition('finished', 'registration')).toBe(false);
  });
});

describe('TournamentsService', () => {
  let s: Services;
  beforeEach(() => {
    s = makeServices();
  });

  test('create: організатор = ініціатор; без ініціатора → UNAUTHENTICATED', async () => {
    const t = await as(ORG, () => s.tournaments.create({ name: ' Cup ', startsOn: '2026-12-01' }));
    expect(t).toMatchObject({ name: 'Cup', organizerId: ORG, status: 'registration' });
    await expect(
      as(undefined, () => s.tournaments.create({ name: 'X', startsOn: '2026-12-01' })),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  test('registerTeam: ідемпотентно; неіснуюча команда → NOT_FOUND', async () => {
    const { tournamentId, teamIds } = await tournamentWithTeams(s, 1);
    const again = await as(ORG, () => s.tournaments.registerTeam(tournamentId, teamIds[0] ?? ''));
    expect(again.created).toBe(false);
    await expect(
      as(ORG, () =>
        s.tournaments.registerTeam(tournamentId, '00000000-0000-4000-8000-000000000000'),
      ),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  test('registerTeam після старту → CONFLICT', async () => {
    const { tournamentId } = await tournamentWithTeams(s, 2);
    await as(ORG, () => s.matches.startTournament(tournamentId));
    const late = await as(ORG, () => s.teams.createTeam({ name: 'Late', city: '' }));
    await expect(
      as(ORG, () => s.tournaments.registerTeam(tournamentId, late.id)),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  test('get неіснуючого → NOT_FOUND; tryTransition з невалідним переходом → CONFLICT', async () => {
    await expect(s.tournaments.get('nope')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const { tournamentId } = await tournamentWithTeams(s, 0);
    await expect(
      s.tournaments.tryTransition(tournamentId, 'registration', 'finished'),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

describe('TeamsService', () => {
  let s: Services;
  beforeEach(() => {
    s = makeServices();
  });

  test('addPlayer: зайнятий номер → CONFLICT; список гравців', async () => {
    const team = await as(ORG, () => s.teams.createTeam({ name: 'A', city: 'Київ' }));
    await as(ORG, () => s.teams.addPlayer(team.id, { fullName: ' Іван ', number: 9 }));
    await expect(
      as(ORG, () => s.teams.addPlayer(team.id, { fullName: 'Петро', number: 9 })),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(await s.teams.listPlayers(team.id)).toEqual([
      expect.objectContaining({ fullName: 'Іван', number: 9 }),
    ]);
  });

  test('різні номери в одній команді дозволені; той самий номер в іншій команді теж', async () => {
    const a = await as(ORG, () => s.teams.createTeam({ name: 'A', city: '' }));
    const b = await as(ORG, () => s.teams.createTeam({ name: 'B', city: '' }));
    await as(ORG, () => s.teams.addPlayer(a.id, { fullName: 'P1', number: 1 }));
    await as(ORG, () => s.teams.addPlayer(a.id, { fullName: 'P2', number: 2 }));
    await as(ORG, () => s.teams.addPlayer(b.id, { fullName: 'P3', number: 1 }));
    expect((await s.teams.listPlayers(a.id)).map((p) => p.number).sort()).toEqual([1, 2]);
  });

  test('createTeam обрізає пробіли і в назві, і в місті (сервіс, не лише HTTP)', async () => {
    const team = await as(ORG, () => s.teams.createTeam({ name: '  A  ', city: ' Київ ' }));
    expect(team).toMatchObject({ name: 'A', city: 'Київ' });
  });

  test('getTeamsByIds: дублікати згортаються; відсутня команда → NOT_FOUND', async () => {
    const a = await as(ORG, () => s.teams.createTeam({ name: 'A', city: '' }));
    expect(await s.teams.getTeamsByIds([a.id, a.id])).toHaveLength(1);
    await expect(s.teams.getTeamsByIds([a.id, 'missing'])).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Teams not found: missing',
    });
  });

  test('getTeamsByIds: у повідомленні лише відсутні id, навіть коли знайдено кілька команд', async () => {
    const a = await as(ORG, () => s.teams.createTeam({ name: 'A', city: '' }));
    const b = await as(ORG, () => s.teams.createTeam({ name: 'B', city: '' }));
    await expect(s.teams.getTeamsByIds([a.id, 'gone', b.id])).rejects.toMatchObject({
      message: 'Teams not found: gone',
    });
  });

  test('listTeams і getTeam', async () => {
    const a = await as(ORG, () => s.teams.createTeam({ name: 'A', city: '' }));
    expect(await s.teams.listTeams()).toHaveLength(1);
    expect(await s.teams.getTeam(a.id)).toEqual(a);
  });
});
