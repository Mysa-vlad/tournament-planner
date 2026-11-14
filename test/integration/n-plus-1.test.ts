import assert from 'node:assert/strict';
import { testDatabaseUrl } from '../test-db.js';
import { test } from 'vitest';
import { createContainer } from '../../src/composition.js';
import { runWithContext, type RequestContext } from '../../src/shared/index.js';

// AC11 / D9: кількість SQL-запитів на читання не залежить від кількості команд (регресія N+1)
const ORG = 'org-queries';

const queriesFor = async (teams: number): Promise<{ schedule: number; standings: number }> => {
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
      };
    });
  } finally {
    await container.close();
  }
};

test('AC11: розклад ≤ 3 і таблиця ≤ 4 SQL-запитів незалежно від N', async () => {
  const small = await queriesFor(3);
  const large = await queriesFor(9);
  assert.deepEqual(large, small, 'кількість запитів зросла разом із N — це N+1');
  assert.ok(small.schedule <= 3, `schedule: ${String(small.schedule)} queries`);
  assert.ok(small.standings <= 4, `standings: ${String(small.standings)} queries`);
});
