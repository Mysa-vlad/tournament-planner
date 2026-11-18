import request from 'supertest';
import { describe, expect, test } from 'vitest';
import { createContainer } from '../../src/composition.js';
import { createApp } from '../../src/http/app.js';

// spec-lab5 AC24: RAM і затримка event loop для аналізу «CPU чи очікування»
describe('GET /metrics', () => {
  test('віддає RAM, затримку event loop і uptime; ?reset=1 не ламає відповідь', async () => {
    const container = await createContainer({
      port: 0,
      version: 'it',
      gitSha: 'test',
      dataSource: 'static',
      databaseUrl: 'memory://',
    });
    const app = createApp(container, { version: 'it', gitSha: 'test' });
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    const body = res.body as {
      rssMb: number;
      heapUsedMb: number;
      eventLoopDelayMs: { p50: number; p99: number; max: number };
      uptimeS: number;
    };
    expect(body.rssMb).toBeGreaterThan(0);
    expect(body.heapUsedMb).toBeGreaterThan(0);
    expect(body.eventLoopDelayMs.p99).toBeGreaterThanOrEqual(body.eventLoopDelayMs.p50);
    expect(Number.isInteger(body.uptimeS)).toBe(true);
    expect((await request(app).get('/metrics?reset=1')).status).toBe(200);
    await container.close();
  });
});
