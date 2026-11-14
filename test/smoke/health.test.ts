import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import { createApp } from '../../src/http/app.js';

let baseUrl = '';
let close: () => void = () => undefined;

before(async () => {
  const app = createApp({ port: 0, version: 'smoke' });
  await new Promise<void>((resolve) => {
    const server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
      close = () => server.close();
      resolve();
    });
  });
});

after(() => {
  close();
});

const post = async (path: string, body: unknown): Promise<Record<string, unknown>> => {
  const res = await fetch(baseUrl + path, {
    method: path.includes('/result') ? 'PUT' : 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  assert.ok(res.ok, `${path} -> ${String(res.status)}`);
  return (await res.json()) as Record<string, unknown>;
};

void test('AC2: GET /health returns 200 {status: ok}', async () => {
  const res = await fetch(`${baseUrl}/health`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'ok', version: 'smoke' });
});

void test('S1-S4: register → start → result → standings', async () => {
  const tournament = await post('/tournaments', { name: 'Кубок ФІОТ', startsOn: '2026-11-20' });
  const teamIds: string[] = [];
  for (const name of ['Ракета', 'Буревій', 'Каштан']) {
    const team = await post('/teams', { name, city: 'Київ' });
    teamIds.push(String(team.id));
    await post(`/tournaments/${String(tournament.id)}/entries`, { teamId: team.id });
  }

  const res = await fetch(`${baseUrl}/tournaments/${String(tournament.id)}/start`, {
    method: 'POST',
  });
  assert.equal(res.status, 201);
  const matches = (await res.json()) as { id: string }[];
  assert.equal(matches.length, 3); // N·(N−1)/2 при N = 3

  const first = matches[0];
  assert.ok(first);
  await post(`/matches/${first.id}/result`, { homeGoals: 2, awayGoals: 1 });

  const table = (await (
    await fetch(`${baseUrl}/tournaments/${String(tournament.id)}/standings`)
  ).json()) as { points: number }[];
  assert.equal(table.length, 3);
  assert.equal(table[0]?.points, 3);
});
