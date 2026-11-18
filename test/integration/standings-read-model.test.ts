import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createContainer, type Container } from '../../src/composition.js';
import {
  createServicesStandingsSource,
  createStandingsService,
} from '../../src/modules/standings/index.js';
import { runWithContext } from '../../src/shared/index.js';
import { testDatabaseUrl } from '../test-db.js';
import { api, startTestServer, type TestServer } from './helpers.js';

const ORG = 'org-read-model';
type Json = Record<string, unknown>;

describe('spec-lab5 AC29: read model таблиці (один SQL) = таблиця через сервіси', () => {
  let container: Container;
  beforeAll(async () => {
    container = await createContainer({
      port: 0,
      version: 'test',
      gitSha: 'test',
      dataSource: 'pg',
      databaseUrl: testDatabaseUrl,
      standingsCacheTtlMs: 0,
    });
  });
  afterAll(() => container.close());

  test('однакові рядки для турніру з результатами, без результатів і без команд', async () => {
    const { services } = container;
    const viaServices = createStandingsService({
      source: createServicesStandingsSource(services.tournaments, services.teams, services.matches),
    });
    await runWithContext({ requestId: 'rm', userId: ORG, queryCount: 0 }, async () => {
      const empty = await services.tournaments.create({ name: 'Empty', startsOn: '2026-12-01' });
      const t = await services.tournaments.create({ name: 'RM', startsOn: '2026-12-01' });
      for (const name of ['Ajax', 'Brugge', 'Celtic', 'Dynamo']) {
        const team = await services.teams.createTeam({ name, city: '' });
        await services.tournaments.registerTeam(t.id, team.id);
      }
      const before = await services.standings.getStandings(t.id);
      expect(before).toEqual(await viaServices.getStandings(t.id));
      const { matches } = await services.matches.startTournament(t.id);
      const scores: [number, number][] = [
        [2, 1],
        [0, 0],
        [1, 3],
      ];
      for (const [i, [h, a]] of scores.entries()) {
        const m = matches[i];
        if (m) await services.matches.recordResult(m.id, h, a);
      }
      const after = await services.standings.getStandings(t.id);
      expect(after).toEqual(await viaServices.getStandings(t.id));
      expect(after.reduce((s, r) => s + r.played, 0)).toBe(6);
      expect(await services.standings.getStandings(empty.id)).toEqual([]);
    });
  });

  test('неіснуючий турнір → NOT_FOUND з обох джерел', async () => {
    const id = '00000000-0000-4000-8000-000000000000';
    await expect(container.services.standings.getStandings(id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    const { services } = container;
    const viaServices = createStandingsService({
      source: createServicesStandingsSource(services.tournaments, services.teams, services.matches),
    });
    await expect(viaServices.getStandings(id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

// spec-lab5 AC30: кеш із великим TTL не віддає застарілу таблицю після запису на цьому інстансі
describe.each(['pg', 'static'] as const)('кеш таблиці скидається після запису (%s)', (source) => {
  let server: TestServer;
  beforeAll(async () => {
    server = await startTestServer({ dataSource: source, standingsCacheTtlMs: 60_000 });
  });
  afterAll(() => server.close());

  test('заявка команди і результат матчу одразу видно в таблиці', async () => {
    const call = api(server.baseUrl);
    const t = (
      await call('POST', '/tournaments', {
        user: ORG,
        body: { name: 'Cache Cup', startsOn: '2026-12-01' },
      })
    ).body;
    const table = async (): Promise<Json[]> =>
      (await call<Json[]>('GET', `/tournaments/${String(t.id)}/standings`)).body;
    expect(await table()).toEqual([]); // закешовано порожню таблицю

    for (const name of ['Cache A', 'Cache B']) {
      const team = (await call('POST', '/teams', { user: ORG, body: { name, city: '' } })).body;
      await call('POST', `/tournaments/${String(t.id)}/entries`, {
        user: ORG,
        body: { teamId: team.id },
      });
    }
    expect((await table()).map((r) => r.teamName)).toEqual(['Cache A', 'Cache B']);

    const [match] = (
      await call<Json[]>('POST', `/tournaments/${String(t.id)}/start`, { user: ORG })
    ).body;
    await call('PUT', `/matches/${String(match?.id)}/result`, {
      user: ORG,
      body: { homeGoals: 0, awayGoals: 2 },
    });
    const rows = await table();
    expect(rows.map((r) => [r.played, r.points])).toEqual([
      [1, 3],
      [1, 0],
    ]);
  });
});
