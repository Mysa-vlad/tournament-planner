// spec-lab5 §3: EXPLAIN (ANALYZE, BUFFERS) запитів, які РЕАЛЬНО виконують сценарії L1–L4.
// Запуск: npm run explain   (локально, PGlite = PostgreSQL 17, набір даних як у spec-lab5 §2)
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createDatabase, createPgUnitOfWork, migrate, type Database } from '../src/db/index.js';
import type { SqlQuery } from '../src/db/sql.js';
import { createMatchesService, createPgMatchesRepository } from '../src/modules/matches/index.js';
import { createPgStandingsSource, createStandingsService } from '../src/modules/standings/index.js';
import { createPgTeamsRepository, createTeamsService } from '../src/modules/teams/index.js';
import {
  createPgTournamentsRepository,
  createTournamentsService,
} from '../src/modules/tournaments/index.js';
import { runWithContext } from '../src/shared/index.js';

const TOURNAMENTS = 20;
const TEAMS = 16;
const ORG = 'explain-organizer';

const main = async (): Promise<void> => {
  const real = await createDatabase('memory://');
  await migrate(real);

  // Database, що записує кожен запит, поки увімкнено capture
  let capture: SqlQuery[] | undefined;
  const db: Database = {
    ...real,
    query: (q) => {
      capture?.push(q);
      return real.query(q);
    },
    transaction: (fn) => real.transaction(fn),
    inTransaction: () => real.inTransaction(),
  };
  const teams = createTeamsService(createPgTeamsRepository(db));
  const tournaments = createTournamentsService(createPgTournamentsRepository(db), teams);
  const matches = createMatchesService({
    repo: createPgMatchesRepository(db),
    tournaments,
    teams,
    uow: createPgUnitOfWork(db),
  });
  // read model, як у composition на pg (spec-lab5 AC29); кеш вимкнено — міряємо сам SQL
  const standings = createStandingsService({ source: createPgStandingsSource(db) });
  const as = <T>(fn: () => Promise<T>): Promise<T> =>
    runWithContext({ requestId: 'explain', userId: ORG, queryCount: 0 }, fn);

  const ids: string[] = [];
  let finishedId = '';
  await as(async () => {
    for (let k = 0; k < TOURNAMENTS; k++) {
      const t = await tournaments.create({
        name: `Load Cup ${String(k + 1)}`,
        startsOn: '2026-12-01',
      });
      for (let i = 0; i < TEAMS; i++) {
        const team = await teams.createTeam({ name: `T${String(k)}-${String(i)}`, city: '' });
        await tournaments.registerTeam(t.id, team.id);
      }
      const { matches: ms } = await matches.startTournament(t.id);
      for (const m of ms.slice(0, ms.length / 2)) await matches.recordResult(m.id, 2, 1);
      finishedId = ms[0]?.id ?? finishedId;
      ids.push(t.id);
    }
  });
  await real.exec('ANALYZE');

  const tid = ids[0] ?? '';
  const scenarios: [string, () => Promise<unknown>][] = [
    ['L1 GET /tournaments/:id/standings', () => standings.getStandings(tid)],
    ['L2 GET /tournaments/:id/matches', () => matches.getSchedule(tid)],
    ['L3 GET /tournaments', () => tournaments.list()],
    ['L4 PUT /matches/:id/result (повтор)', () => as(() => matches.recordResult(finishedId, 2, 1))],
  ];

  const sections: string[] = [];
  for (const [name, run] of scenarios) {
    capture = [];
    await run();
    const queries = capture;
    capture = undefined;
    sections.push(`## ${name} — ${String(queries.length)} SQL-запитів`, '');
    for (const q of queries) {
      const plan = await real.query<{ 'QUERY PLAN': string }>({
        text: `EXPLAIN (ANALYZE, BUFFERS) ${q.text}`,
        values: q.values,
      });
      sections.push(
        '```sql',
        q.text.replace(/\s+/g, ' ').trim(),
        '```',
        '```',
        ...plan.map((r) => r['QUERY PLAN']),
        '```',
        '',
      );
    }
  }
  await real.close();

  const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD']).toString().trim();
  const md = [
    `# EXPLAIN (ANALYZE, BUFFERS) @ \`${sha}\``,
    '',
    `Відтворення: \`npm run explain\` · PGlite (PostgreSQL 17) · ${String(TOURNAMENTS)} турнірів × ${String(TEAMS)} команд, половина матчів завершена · після \`ANALYZE\``,
    '',
    ...sections,
  ].join('\n');
  await mkdir(join('docs', 'perf'), { recursive: true });
  await writeFile(join('docs', 'perf', `explain-${sha}.md`), md);
  console.info(md);
};

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
