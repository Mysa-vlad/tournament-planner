import request from 'supertest';
import { testDatabaseUrl } from '../test-db.js';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createContainer, type Container } from '../../src/composition.js';
import { createApp } from '../../src/http/app.js';

// Інтеграційний рівень: express-застосунок + справжній PostgreSQL, через supertest (без мережі)
let container: Container;
let app: ReturnType<typeof createApp>;
const ORG = 'org-http';
type Json = Record<string, unknown>;
const json = (res: request.Response): Json => res.body as Json;

beforeAll(async () => {
  container = await createContainer({
    port: 0,
    version: 'it',
    gitSha: 'test',
    dataSource: 'pg',
    databaseUrl: testDatabaseUrl,
  });
  app = createApp(container, { version: 'it', gitSha: 'test' });
});
afterAll(() => container.close());

describe('request-контекст і заголовки (D7)', () => {
  test('X-Request-Id: валідний приймається, невалідний замінюється на UUID', async () => {
    const ok = await request(app).get('/health').set('x-request-id', 'client-req-123');
    expect(ok.headers['x-request-id']).toBe('client-req-123');
    const bad = await request(app).get('/health').set('x-request-id', 'bad id!');
    expect(bad.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  test('порожній X-User-Id = анонім → запис 401', async () => {
    const res = await request(app).post('/teams').set('x-user-id', '  ').send({ name: 'A' });
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: 'UNAUTHENTICATED' });
  });
});

describe('HTTP-контракт ресурсів', () => {
  test('teams: create → get → players → list', async () => {
    const team = await request(app).post('/teams').set('x-user-id', ORG).send({ name: 'Ракета' });
    expect(team.status).toBe(201);
    expect(team.body).toMatchObject({ name: 'Ракета', city: '' });
    const id = String(json(team).id);

    expect((await request(app).get(`/teams/${id}`)).body).toEqual(team.body);
    const player = await request(app)
      .post(`/teams/${id}/players`)
      .set('x-user-id', ORG)
      .send({ fullName: 'Іван', number: 7 });
    expect(player.status).toBe(201);
    const dup = await request(app)
      .post(`/teams/${id}/players`)
      .set('x-user-id', ORG)
      .send({ fullName: 'Петро', number: 7 });
    expect(dup.status).toBe(409);
    // повний об'єкт, а не лише кількість: інакше маплінг рядка БД у Player не перевірено
    expect((await request(app).get(`/teams/${id}/players`)).body).toEqual([
      { id: json(player).id, teamId: id, fullName: 'Іван', number: 7 },
    ]);
    expect(((await request(app).get('/teams')).body as unknown[]).length).toBeGreaterThanOrEqual(1);
  });

  test('валідація тіла: номер гравця поза 1..99 → 400 з полем', async () => {
    const team = await request(app).post('/teams').set('x-user-id', ORG).send({ name: 'B' });
    const res = await request(app)
      .post(`/teams/${String(json(team).id)}/players`)
      .set('x-user-id', ORG)
      .send({ fullName: 'X', number: 100 });
    expect(res.status).toBe(400);
    expect(json(res).fields).toEqual([expect.objectContaining({ path: 'number' })]);
  });

  test('tournaments: невалідна дата → 400; list містить створений', async () => {
    const bad = await request(app)
      .post('/tournaments')
      .set('x-user-id', ORG)
      .send({ name: 'Cup', startsOn: '2026-13-45' });
    expect(bad.status).toBe(400);
    const ok = await request(app)
      .post('/tournaments')
      .set('x-user-id', ORG)
      .send({ name: 'Cup', startsOn: '2026-12-01' });
    expect(ok.status).toBe(201);
    const list = await request(app).get('/tournaments');
    expect(list.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: json(ok).id })]),
    );
  });

  test('невідомий маршрут → 404 JSON', async () => {
    const res = await request(app).delete('/teams');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'NOT_FOUND', message: 'Route not found' });
  });
});
