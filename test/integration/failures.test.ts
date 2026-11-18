import assert from 'node:assert/strict';
import { test } from 'vitest';
import { createContainer } from '../../src/composition.js';
import { api, startTestServer } from './helpers.js';

// AC12: збій БД під час роботи → 503 + Retry-After, процес живий, повторне закриття безпечне
test('AC12: БД недоступна під час запиту → 503, процес не падає', async () => {
  const srv = await startTestServer({ dataSource: 'pg' });
  const call = api(srv.baseUrl);
  assert.equal((await call('GET', '/teams')).status, 200);

  await srv.container.close(); // імітація втрати БД
  const res = await call('GET', '/teams');
  assert.equal(res.status, 503);
  assert.equal(res.body.error, 'SOURCE_UNAVAILABLE');
  assert.equal(res.headers.get('retry-after'), '5');
  assert.ok(res.body.requestId);

  // сервер далі відповідає (процес живий), а повторний close() — no-op
  assert.equal((await call('GET', '/health')).status, 200);
  await assert.doesNotReject(srv.close());
});

test('AC8: недоступна БД на старті → помилка ініціалізації, а не «лінива» на першому запиті', async () => {
  await assert.rejects(
    createContainer({
      port: 0,
      version: 'test',
      dataSource: 'pg',
      databaseUrl: 'idb://not-supported-in-node',
    }),
    /Database initialisation failed/,
  );
});
