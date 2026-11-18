import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { testDatabaseUrl } from '../test-db.js';
import {
  createDatabase,
  createPgUnitOfWork,
  migrate,
  sql,
  type Database,
} from '../../src/db/index.js';
import {
  createPgMatchesRepository,
  type Match,
  type MatchesRepository,
} from '../../src/modules/matches/index.js';
import { createPgTeamsRepository, type TeamsRepository } from '../../src/modules/teams/index.js';
import {
  createPgTournamentsRepository,
  type TournamentsRepository,
} from '../../src/modules/tournaments/index.js';
import { newId } from '../../src/shared/index.js';

// Інтеграційний рівень: справжній PostgreSQL (PGlite), окрема база на файл тестів
let db: Database;
beforeAll(async () => {
  db = await createDatabase(testDatabaseUrl);
  await migrate(db);
});
afterAll(() => db.close());

beforeEach(async () => {
  await db.exec('TRUNCATE matches, tournament_entries, tournaments, players, teams CASCADE');
});

const teamsRepo = (): TeamsRepository => createPgTeamsRepository(db);
const tournamentsRepo = (): TournamentsRepository => createPgTournamentsRepository(db);
const matchesRepo = (): MatchesRepository => createPgMatchesRepository(db);

const seedTournament = async (teamCount: number): Promise<{ tid: string; teamIds: string[] }> => {
  const tid = newId();
  await tournamentsRepo().insert({
    id: tid,
    name: 'Cup',
    status: 'registration',
    startsOn: '2026-12-01',
    organizerId: 'org',
  });
  const teamIds: string[] = [];
  for (let i = 0; i < teamCount; i++) {
    const id = newId();
    await teamsRepo().insert({ id, name: `T${String(i)}`, city: '' });
    teamIds.push(id);
  }
  return { tid, teamIds };
};

describe('teams repository', () => {
  test('insert/findById/findByIds/list', async () => {
    const { teamIds } = await seedTournament(3);
    expect(await teamsRepo().findById(teamIds[0] ?? '')).toMatchObject({ name: 'T0', city: '' });
    expect(await teamsRepo().findById(newId())).toBeUndefined();
    expect(await teamsRepo().findByIds(teamIds.slice(0, 2))).toHaveLength(2);
    expect(await teamsRepo().findByIds([])).toEqual([]);
    expect((await teamsRepo().list()).map((t) => t.name)).toEqual(['T0', 'T1', 'T2']);
  });

  test('UNIQUE(team_id, number) → DomainError CONFLICT (гонка поза сервісом)', async () => {
    const { teamIds } = await seedTournament(1);
    const teamId = teamIds[0] ?? '';
    await teamsRepo().insertPlayer({ id: newId(), teamId, fullName: 'A', number: 10 });
    await expect(
      teamsRepo().insertPlayer({ id: newId(), teamId, fullName: 'B', number: 10 }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(await teamsRepo().listPlayers(teamId)).toHaveLength(1);
  });
});

describe('tournaments repository', () => {
  test('insertEntryIfAbsent: ON CONFLICT DO NOTHING — повтор повертає наявну заявку', async () => {
    const { tid, teamIds } = await seedTournament(1);
    const entry = {
      tournamentId: tid,
      teamId: teamIds[0] ?? '',
      registeredAt: '2026-11-01T10:00:00.000Z',
    };
    const first = await tournamentsRepo().insertEntryIfAbsent(entry);
    const second = await tournamentsRepo().insertEntryIfAbsent({
      ...entry,
      registeredAt: '2026-11-02T10:00:00.000Z',
    });
    expect(first.created).toBe(true);
    expect(second).toEqual({ entry: first.entry, created: false });
    expect(await tournamentsRepo().listEntries(tid)).toHaveLength(1);
  });

  test('transitionStatus: compare-and-set спрацьовує рівно раз', async () => {
    const { tid } = await seedTournament(0);
    expect(await tournamentsRepo().transitionStatus(tid, 'registration', 'in_progress')).toBe(true);
    expect(await tournamentsRepo().transitionStatus(tid, 'registration', 'in_progress')).toBe(
      false,
    );
    expect((await tournamentsRepo().findById(tid))?.status).toBe('in_progress');
  });

  test('CHECK на status: невалідний статус відхиляє БД', async () => {
    await expect(
      db.query(sql`INSERT INTO tournaments (id, name, starts_on, status, organizer_id)
                   VALUES (${newId()}, 'x', '2026-01-01', 'paused', 'o')`),
    ).rejects.toMatchObject({ code: '23514' });
  });
});

describe('matches repository', () => {
  const schedule = (tid: string, a: string, b: string): Match => ({
    id: newId(),
    tournamentId: tid,
    round: 1,
    homeTeamId: a,
    awayTeamId: b,
    status: 'scheduled',
    homeGoals: null,
    awayGoals: null,
  });

  test('insertMany (unnest) + listByTournament + finishIfScheduled + countUnfinished', async () => {
    const { tid, teamIds } = await seedTournament(3);
    const [a = '', b = '', c = ''] = teamIds;
    await matchesRepo().insertMany([schedule(tid, a, b), schedule(tid, b, c)]);
    const list = await matchesRepo().listByTournament(tid);
    expect(list).toHaveLength(2);
    expect(await matchesRepo().countUnfinished(tid)).toBe(2);

    const id = list[0]?.id ?? '';
    expect(await matchesRepo().finishIfScheduled(id, 3, 2)).toMatchObject({
      status: 'finished',
      homeGoals: 3,
    });
    expect(await matchesRepo().finishIfScheduled(id, 0, 0)).toBeUndefined();
    expect(await matchesRepo().countUnfinished(tid)).toBe(1);
    await expect(matchesRepo().insertMany([])).resolves.toBeUndefined();
  });

  test('обмеження БД: команда не грає сама з собою; подвійний розклад відхиляється (AC9)', async () => {
    const { tid, teamIds } = await seedTournament(2);
    const [a = '', b = ''] = teamIds;
    await expect(matchesRepo().insertMany([schedule(tid, a, a)])).rejects.toMatchObject({
      code: '23514',
    });
    await matchesRepo().insertMany([schedule(tid, a, b)]);
    await expect(matchesRepo().insertMany([schedule(tid, a, b)])).rejects.toMatchObject({
      code: '23505',
    });
  });
});

describe('транзакції', () => {
  test('помилка всередині UnitOfWork відкочує всі зміни', async () => {
    const id = newId();
    await expect(
      createPgUnitOfWork(db).run(async () => {
        await teamsRepo().insert({ id, name: 'Rolled back', city: '' });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await teamsRepo().findById(id)).toBeUndefined();
  });

  test('міграції ідемпотентні: повторний migrate нічого не застосовує й не ламає', async () => {
    const count = async (): Promise<number> =>
      (await db.query<{ n: number }>(sql`SELECT count(*)::int AS n FROM schema_migrations`))[0]
        ?.n ?? 0;
    const before = await count();
    await expect(migrate(db)).resolves.toEqual([]);
    expect(await count()).toBe(before);
  });
});
