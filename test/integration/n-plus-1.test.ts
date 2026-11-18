import assert from 'node:assert/strict';
import { testDatabaseUrl } from '../test-db.js';
import { test } from 'vitest';
import { createContainer } from '../../src/composition.js';
import { runWithContext, type RequestContext } from '../../src/shared/index.js';

// AC11 / D9: кількість SQL-запитів на читання не залежить від кількості команд (регресія N+1)
const ORG = 'org-queries';

interface Counts {
  schedule: number;
  standings: number;
  standingsCached: number;
}

const queriesFor = async (teams: number): Promise<Counts> => {
  const container = await createContainer({
    port: 0,
    version: 'test',
    gitSha: 'test',
    dataSource: 'pg',
    databaseUrl: testDatabaseUrl,
  });
  const { services } = container;
  try {
    return await runWithContext({ requestId: 'setup', userId: ORG, queryCount: 0 }, async () => {
      const t = await services.tournaments.create({ name: 'Q', startsOn: '2026-12-01' });
      for (let i = 0; i < teams; i++) {
        const team = await services.teams.createTeam({ name: `T${String(i)}`, city: '' });
        await services.tournaments.registerTeam(t.id, team.id);
      }
      await services.matches.startTournament(t.id);

      const measure = async (fn: () => Promise<unknown>): Promise<number> => {
        const ctx: RequestContext = { requestId: 'measure', userId: ORG, queryCount: 0 };
        await runWithContext(ctx, fn);
        return ctx.queryCount;
      };
      return {
        schedule: await measure(() => services.matches.getSchedule(t.id)),
        standings: await measure(() => services.standings.getStandings(t.id)),
        standingsCached: await measure(() => services.standings.getStandings(t.id)),
      };
    });
  } finally {
    await container.close();
  }
};

// spec-lab5 AC29/AC30: таблиця — 1 SQL (read model) на холодний кеш і 0 — з кешу
test('AC11: розклад ≤ 3 і таблиця = 1 SQL-запит незалежно від N; з кешу — 0', async () => {
  const small = await queriesFor(3);
  const large = await queriesFor(9);
  assert.deepEqual(large, small, 'кількість запитів зросла разом із N — це N+1');
  assert.ok(small.schedule <= 3, `schedule: ${String(small.schedule)} queries`);
  assert.equal(small.standings, 1, `standings: ${String(small.standings)} queries`);
  assert.equal(small.standingsCached, 0, 'повторне читання в межах TTL не йде в БД');
});
