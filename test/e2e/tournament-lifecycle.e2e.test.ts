import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

// E2E (spec-lab3 AC14): зібраний застосунок окремим процесом, справжні мережа й диск.
// Тест бачить систему лише так, як клієнт: через HTTP.

type Json = Record<string, unknown>;
const ORG = 'e2e-organizer';

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, () => {
      const address = srv.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      srv.close(() => {
        resolve(port);
      });
    });
  });

interface RunningApp {
  readonly baseUrl: string;
  stop(): Promise<void>;
}

const startApp = async (dataDir: string): Promise<RunningApp> => {
  const port = await freePort();
  const child: ChildProcess = spawn(process.execPath, ['dist/server.js'], {
    env: {
      ...process.env,
      PORT: String(port),
      DATA_SOURCE: 'pg',
      DATABASE_URL: dataDir,
      LOG_LEVEL: 'warn',
    },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  const baseUrl = `http://127.0.0.1:${String(port)}`;
  const deadline = Date.now() + 20_000;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`app exited early with ${String(child.exitCode)}`);
    try {
      if ((await fetch(`${baseUrl}/health`)).ok) break;
    } catch {
      // ще не слухає порт
    }
    if (Date.now() > deadline) throw new Error('app did not become healthy in 20 s');
    await new Promise((r) => setTimeout(r, 200));
  }
  return {
    baseUrl,
    stop: () =>
      new Promise((resolve) => {
        if (child.exitCode !== null) {
          resolve();
          return;
        }
        child.once('exit', () => {
          resolve();
        });
        child.kill();
      }),
  };
};

const client =
  (baseUrl: string) =>
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- T: очікувана форма JSON-відповіді, задається у виклику
  async <T = Json>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<{ status: number; body: T }> => {
    const res = await fetch(baseUrl + path, {
      method,
      headers: { 'content-type': 'application/json', 'x-user-id': ORG },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: res.status, body: (await res.json()) as T };
  };

describe('E2E: життєвий цикл турніру через процес застосунку', () => {
  let dataDir: string;
  let app: RunningApp;

  beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'tournament-e2e-'));
    app = await startApp(dataDir);
  });
  afterAll(async () => {
    await app.stop();
    await rm(dataDir, { recursive: true, force: true });
  });

  test('S1–S5, потім перезапуск: дані й таблиця збереглися', async () => {
    const call = client(app.baseUrl);
    const t = await call('POST', '/tournaments', { name: 'E2E Cup', startsOn: '2026-12-05' });
    expect(t.status).toBe(201);
    const tid = String(t.body.id);

    for (const name of ['Ракета', 'Буревій', 'Каштан', 'Дніпро']) {
      const team = await call('POST', '/teams', { name, city: 'Київ' });
      expect(team.status).toBe(201);
      expect(
        (await call('POST', `/tournaments/${tid}/entries`, { teamId: team.body.id })).status,
      ).toBe(201);
    }

    const start = await call<Json[]>('POST', `/tournaments/${tid}/start`);
    expect(start.status).toBe(201);
    expect(start.body).toHaveLength(6);

    // усі результати: господарі виграють 1:0
    for (const m of start.body) {
      const res = await call('PUT', `/matches/${String(m.id)}/result`, {
        homeGoals: 1,
        awayGoals: 0,
      });
      expect(res.status).toBe(200);
    }
    expect((await call('GET', `/tournaments/${tid}`)).body.status).toBe('finished');
    const before = await call<Json[]>('GET', `/tournaments/${tid}/standings`);
    expect(before.body.reduce((sum, row) => sum + Number(row.played), 0)).toBe(12);

    // перезапуск процесу на тій самій БД
    await app.stop();
    app = await startApp(dataDir);
    const after = await client(app.baseUrl)<Json[]>('GET', `/tournaments/${tid}/standings`);
    expect(after.status).toBe(200);
    expect(after.body).toEqual(before.body);
  });
});
