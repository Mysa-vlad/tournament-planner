// Аудит N+1 (spec-lab2 AC11): скільки SQL-запитів робить читання розкладу й таблиці
// залежно від кількості команд N. Запуск: npm run probe:queries
import { createContainer } from '../src/composition.js';
import { runWithContext, type RequestContext } from '../src/shared/index.js';

const measure = async <T>(userId: string, fn: () => Promise<T>): Promise<number> => {
  const ctx: RequestContext = { requestId: `probe-${String(Date.now())}`, userId, queryCount: 0 };
  await runWithContext(ctx, fn);
  return ctx.queryCount;
};

const ORG = 'probe-organizer';
const rows: string[] = ['| N команд | матчів | GET matches (запитів) | GET standings (запитів) |'];
rows.push('| --- | --- | --- | --- |');

for (const n of [4, 8, 16]) {
  const container = await createContainer({
    port: 0,
    version: 'probe',
    dataSource: 'pg',
    databaseUrl: 'memory://',
  });
  await runWithContext({ requestId: 'probe-setup', userId: ORG, queryCount: 0 }, async () => {
    const { services } = container;
    const t = await services.tournaments.create({
      name: `Probe ${String(n)}`,
      startsOn: '2026-12-01',
    });
    for (let i = 0; i < n; i++) {
      const team = await services.teams.createTeam({ name: `Team ${String(i)}`, city: '' });
      await services.tournaments.registerTeam(t.id, team.id);
    }
    const { matches } = await services.matches.startTournament(t.id);
    for (const m of matches.slice(0, n)) await services.matches.recordResult(m.id, 1, 0);

    const schedule = await measure(ORG, () => services.matches.getSchedule(t.id));
    const standings = await measure(ORG, () => services.standings.getStandings(t.id));
    rows.push(
      `| ${String(n)} | ${String(matches.length)} | ${String(schedule)} | ${String(standings)} |`,
    );
  });
  await container.close();
}

console.info(rows.join('\n'));
