// Аудит крайових випадків і поведінки на збоях (spec-lab2 §4). Запуск: npm run probe:edge
import { api, startTestServer } from '../test/smoke/helpers.js';
const rows = [
  '| джерело | GET /tournaments/not-a-uuid | POST /teams з тілом 200 КБ | БД закрито → GET | повторний close() |',
  '| --- | --- | --- | --- | --- |',
];
for (const dataSource of ['static', 'pg'] as const) {
  const srv = await startTestServer({ dataSource });
  const call = api(srv.baseUrl);
  const bad = await call('GET', '/tournaments/not-a-uuid');
  const big = await fetch(`${srv.baseUrl}/teams`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-user-id': 'u' },
    body: JSON.stringify({ name: 'x'.repeat(200_000) }),
  });
  await srv.container.close();
  const down = await call('GET', '/teams');
  const second = await srv.container.close().then(
    () => 'ok',
    (e: unknown) => `throws: ${String(e)}`,
  );
  rows.push(
    `| ${dataSource} | ${String(bad.status)} | ${String(big.status)} | ${String(down.status)} | ${second} |`,
  );
}
console.info(rows.join('\n'));
process.exit(0);
