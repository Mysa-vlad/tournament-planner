import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { DataSource } from '../../src/config/env.js';
import { api, startTestServer, type TestServer } from './helpers.js';

type Json = Record<string, unknown>;

// AC7: один і той самий сценарій має проходити на кожному джерелі даних
const SOURCES: readonly DataSource[] = (process.env.SMOKE_SOURCES ?? 'static')
  .split(',')
  .map((s) => s.trim() as DataSource);

for (const dataSource of SOURCES) {
  void describe(`smoke S1–S5 [${dataSource}]`, () => {
    let srv: TestServer;
    let call: ReturnType<typeof api>;
    const ORG = 'org-alice';

    before(async () => {
      srv = await startTestServer({ dataSource });
      call = api(srv.baseUrl);
    });
    after(() => srv.close());

    void test('AC2: GET /health → 200 і X-Request-Id', async () => {
      const res = await call('GET', '/health');
      assert.equal(res.status, 200);
      assert.equal(res.body.status, 'ok');
      assert.ok(res.headers.get('x-request-id'));
    });

    void test('S1–S5 через API: заявки → старт → результати → таблиця → завершення', async () => {
      // запис без ініціатора → 401
      assert.equal((await call('POST', '/teams', { body: { name: 'X' } })).status, 401);

      const t = await call('POST', '/tournaments', {
        user: ORG,
        body: { name: 'Кубок ФІОТ', startsOn: '2026-11-21' },
      });
      assert.equal(t.status, 201);
      assert.equal(t.body.organizerId, ORG);
      const tid = String(t.body.id);

      const teamIds: string[] = [];
      for (const name of ['Ракета', 'Буревій', 'Каштан']) {
        const team = await call('POST', '/teams', { user: ORG, body: { name, city: 'Київ' } });
        assert.equal(team.status, 201);
        teamIds.push(String(team.body.id));
        const entry = await call('POST', `/tournaments/${tid}/entries`, {
          user: ORG,
          body: { teamId: team.body.id },
        });
        assert.equal(entry.status, 201);
      }
      // S1 повтор → 200, без дубля (AC9)
      const again = await call('POST', `/tournaments/${tid}/entries`, {
        user: ORG,
        body: { teamId: teamIds[0] },
      });
      assert.equal(again.status, 200);

      // S2: не організатор → 403
      assert.equal((await call('POST', `/tournaments/${tid}/start`, { user: 'bob' })).status, 403);
      const start = await call<Json[]>('POST', `/tournaments/${tid}/start`, { user: ORG });
      assert.equal(start.status, 201);
      assert.equal(start.body.length, 3);
      // S2 повтор → 200, той самий розклад (AC9)
      const restart = await call<Json[]>('POST', `/tournaments/${tid}/start`, { user: ORG });
      assert.equal(restart.status, 200);
      assert.deepEqual(restart.body.map((m) => m.id).sort(), start.body.map((m) => m.id).sort());
      // заявки після старту → 409
      const late = await call('POST', '/teams', { user: ORG, body: { name: 'Запізнілі' } });
      assert.equal(
        (
          await call('POST', `/tournaments/${tid}/entries`, {
            user: ORG,
            body: { teamId: late.body.id },
          })
        ).status,
        409,
      );

      const schedule = await call<Json[]>('GET', `/tournaments/${tid}/matches`);
      assert.equal(schedule.status, 200);
      assert.ok(schedule.body.every((m) => typeof m.homeTeamName === 'string'));

      // S3: невалідний рахунок → 400; не організатор → 403
      const [m1, m2, m3] = start.body.map((m) => String(m.id));
      assert.ok(m1 && m2 && m3);
      assert.equal(
        (await call('PUT', `/matches/${m1}/result`, { user: ORG, body: { homeGoals: -1 } })).status,
        400,
      );
      const score = { homeGoals: 2, awayGoals: 1 };
      assert.equal(
        (await call('PUT', `/matches/${m1}/result`, { user: 'bob', body: score })).status,
        403,
      );
      assert.equal(
        (await call('PUT', `/matches/${m1}/result`, { user: ORG, body: score })).status,
        200,
      );
      // повтор того ж рахунку → 200; інший рахунок → 409 (AC9)
      assert.equal(
        (await call('PUT', `/matches/${m1}/result`, { user: ORG, body: score })).status,
        200,
      );
      assert.equal(
        (
          await call('PUT', `/matches/${m1}/result`, {
            user: ORG,
            body: { homeGoals: 0, awayGoals: 0 },
          })
        ).status,
        409,
      );

      // S4: таблиця
      const table = await call<Json[]>('GET', `/tournaments/${tid}/standings`);
      assert.equal(table.status, 200);
      assert.equal(table.body.length, 3);
      assert.equal(table.body[0]?.points, 3);

      // S5: останні результати → турнір finished
      for (const m of [m2, m3]) {
        await call('PUT', `/matches/${m}/result`, {
          user: ORG,
          body: { homeGoals: 1, awayGoals: 1 },
        });
      }
      assert.equal((await call('GET', `/tournaments/${tid}`)).body.status, 'finished');
    });

    void test('помилки: 404 сутності, 404 маршруту, 400 невалідний JSON', async () => {
      const missing = await call('GET', '/tournaments/00000000-0000-4000-8000-000000000999');
      assert.equal(missing.status, 404);
      assert.ok(missing.body.requestId);
      assert.equal((await call('GET', '/nope')).status, 404);
      const res = await fetch(`${srv.baseUrl}/teams`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-user-id': ORG },
        body: '{bad json',
      });
      assert.equal(res.status, 400);
    });
  });
}
