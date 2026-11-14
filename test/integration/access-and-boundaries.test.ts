import request from 'supertest';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createContainer, type Container } from '../../src/composition.js';
import { createApp } from '../../src/http/app.js';

// spec-lab3 T5: негативні тести на межах правил spec-lab2 §2/§4 (а не лише щасливий шлях)
let container: Container;
let app: ReturnType<typeof createApp>;
const ORG = 'org-boundaries';
type Json = Record<string, unknown>;
const json = (res: request.Response): Json => res.body as Json;

let tournamentId = '';
let teamId = '';

beforeAll(async () => {
  container = await createContainer({
    port: 0,
    version: 'it',
    dataSource: 'pg',
    databaseUrl: 'memory://',
  });
  app = createApp(container.services, { version: 'it' });

  const t = await request(app)
    .post('/tournaments')
    .set('x-user-id', ORG)
    .send({ name: 'Bounds', startsOn: '2026-12-01' });
  tournamentId = String(json(t).id);
  for (const name of ['A', 'B']) {
    const team = await request(app).post('/teams').set('x-user-id', ORG).send({ name });
    teamId = String(json(team).id);
    await request(app)
      .post(`/tournaments/${tournamentId}/entries`)
      .set('x-user-id', ORG)
      .send({ teamId });
  }
});
afterAll(() => container.close());

describe('доступ: кожна операція запису без X-User-Id → 401 (spec-lab2 §2)', () => {
  const writes = (): [string, string, Json][] => [
    ['POST', '/teams', { name: 'Anon' }],
    ['POST', `/teams/${teamId}/players`, { fullName: 'Anon', number: 5 }],
    ['POST', '/tournaments', { name: 'Anon', startsOn: '2026-12-01' }],
    ['POST', `/tournaments/${tournamentId}/entries`, { teamId }],
    ['POST', `/tournaments/${tournamentId}/start`, {}],
  ];

  test('анонім не може нічого записати, і нічого не змінюється', async () => {
    for (const [method, path, body] of writes()) {
      const res = await request(app)[method === 'POST' ? 'post' : 'put'](path).send(body);
      expect({ path, status: res.status }).toEqual({ path, status: 401 });
    }
    expect((await request(app).get(`/teams/${teamId}/players`)).body).toEqual([]);
    expect(json(await request(app).get(`/tournaments/${tournamentId}`)).status).toBe(
      'registration',
    );
  });
});
