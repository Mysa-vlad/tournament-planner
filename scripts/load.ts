// spec-lab5 AC23: навантажувальний тест. Запуск:
//   npm run load -- http://localhost:3000 --label=local
//   npm run load -- https://tournament-planner-staging.onrender.com --label=staging
// Опції: --duration=20 --connections=10 --repeats=3 --scenarios=L1,L2,L3,LMIX --label=… --no-seed
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import autocannon from 'autocannon';

type Json = Record<string, unknown>;

const args = process.argv.slice(2);
const flag = (name: string, fallback: string): string =>
  args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const target = (args.find((a) => !a.startsWith('--')) ?? 'http://localhost:3000').replace(
  /\/$/,
  '',
);
const DURATION = Number(flag('duration', '20'));
const CONNECTIONS = Number(flag('connections', '10'));
const REPEATS = Number(flag('repeats', '3'));
const SCENARIOS = flag('scenarios', 'L1,L2,L3,LMIX').split(',');
const LABEL = flag('label', 'run');
const SEED = !args.includes('--no-seed');
const ORG = 'load-organizer';
const TOURNAMENTS = 20;
const TEAMS = 16;

const api = async <T = Json>(method: string, path: string, body?: unknown): Promise<T> => {
  const res = await fetch(target + path, {
    method,
    headers: { 'content-type': 'application/json', 'x-user-id': ORG },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(120_000), // Render Free «прокидається» до ~50 с
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${String(res.status)}`);
  return (await res.json()) as T;
};

interface Dataset {
  readonly tournamentIds: string[];
  /** завершені матчі: повтор того самого рахунку ідемпотентний (spec-lab2 AC9) */
  readonly finished: { id: string; homeGoals: number; awayGoals: number }[];
}

/** 20 турнірів × 16 команд; половина матчів кожного турніру завершена (spec-lab5 §2). */
const ensureDataset = async (): Promise<Dataset> => {
  const existing = (await api<Json[]>('GET', '/tournaments')).filter((t) =>
    String(t.name).startsWith('Load Cup '),
  );
  const ids = existing.map((t) => String(t.id));
  for (let k = ids.length; SEED && k < TOURNAMENTS; k++) {
    const t = await api('POST', '/tournaments', {
      name: `Load Cup ${String(k + 1)}`,
      startsOn: '2026-12-01',
    });
    const tid = String(t.id);
    for (let i = 0; i < TEAMS; i++) {
      const team = await api('POST', '/teams', {
        name: `Load T${String(k + 1)}-${String(i + 1)}`,
        city: 'Kyiv',
      });
      await api('POST', `/tournaments/${tid}/entries`, { teamId: team.id });
    }
    const matches = await api<Json[]>('POST', `/tournaments/${tid}/start`);
    for (const m of matches.slice(0, matches.length / 2)) {
      await api('PUT', `/matches/${String(m.id)}/result`, {
        homeGoals: (k + 2) % 4,
        awayGoals: k % 3,
      });
    }
    ids.push(tid);
    console.info(`seeded tournament ${String(k + 1)}/${String(TOURNAMENTS)}`);
  }
  const finished: Dataset['finished'] = [];
  for (const tid of ids) {
    const schedule = await api<Json[]>('GET', `/tournaments/${tid}/matches`);
    for (const m of schedule) {
      if (m.status === 'finished') {
        finished.push({
          id: String(m.id),
          homeGoals: Number(m.homeGoals),
          awayGoals: Number(m.awayGoals),
        });
      }
    }
  }
  return { tournamentIds: ids, finished };
};

const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)] as T;

interface Req {
  method: 'GET' | 'PUT';
  path: string;
  headers?: Record<string, string>;
  body?: string;
}

const scenario = (name: string, d: Dataset): (() => Req) => {
  const standings = (): Req => ({
    method: 'GET',
    path: `/tournaments/${pick(d.tournamentIds)}/standings`,
  });
  const schedule = (): Req => ({
    method: 'GET',
    path: `/tournaments/${pick(d.tournamentIds)}/matches`,
  });
  const list = (): Req => ({ method: 'GET', path: '/tournaments' });
  const result = (): Req => {
    const m = pick(d.finished);
    return {
      method: 'PUT',
      path: `/matches/${m.id}/result`,
      headers: { 'content-type': 'application/json', 'x-user-id': ORG },
      body: JSON.stringify({ homeGoals: m.homeGoals, awayGoals: m.awayGoals }),
    };
  };
  switch (name) {
    case 'L1':
      return standings;
    case 'L2':
      return schedule;
    case 'L3':
      return list;
    case 'LMIX':
      return () => {
        const r = Math.random();
        if (r < 0.5) return standings();
        if (r < 0.8) return schedule();
        if (r < 0.95) return list();
        return result();
      };
    default:
      throw new Error(`unknown scenario ${name}`);
  }
};

const percentile = (sorted: readonly number[], p: number): number =>
  sorted.length === 0
    ? 0
    : (sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] ?? 0);

interface Run {
  readonly p50: number;
  readonly p95: number;
  readonly p99: number;
  readonly rps: number;
  readonly requests: number;
  readonly errors: number;
  readonly loopP99: number;
  readonly rssMb: number;
}

const runOnce = async (make: () => Req): Promise<Run> => {
  // /metrics з'явився в завданні 5; на старій версії (базова лінія) його ще немає
  await api('GET', '/metrics?reset=1').catch(() => undefined);
  const latencies: number[] = [];
  let errors = 0;
  const result = await new Promise<autocannon.Result>((resolve, reject) => {
    const instance = autocannon(
      {
        url: target,
        connections: CONNECTIONS,
        duration: DURATION,
        requests: [{ setupRequest: (req) => ({ ...req, ...make() }) }],
      },
      (err, res) => {
        if (err) reject(err instanceof Error ? err : new Error(String(err)));
        else resolve(res);
      },
    );
    // точні перцентилі (зокрема p95, якого немає у звіті autocannon) з часу кожного запиту
    instance.on('response', (_client, statusCode, _bytes, responseTime) => {
      latencies.push(responseTime);
      if (statusCode >= 400) errors += 1;
    });
  });
  const m = await api<{ eventLoopDelayMs: { p99: number }; rssMb: number }>(
    'GET',
    '/metrics',
  ).catch(() => ({ eventLoopDelayMs: { p99: Number.NaN }, rssMb: Number.NaN }));
  latencies.sort((a, b) => a - b);
  return {
    p50: percentile(latencies, 50),
    p95: percentile(latencies, 95),
    p99: percentile(latencies, 99),
    rps: Math.round(result.requests.average),
    requests: latencies.length,
    errors: errors + result.errors + result.timeouts,
    loopP99: m.eventLoopDelayMs.p99,
    rssMb: m.rssMb,
  };
};

const median = (xs: readonly number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
};
const r1 = (x: number): string => (Number.isNaN(x) ? 'n/a' : (Math.round(x * 10) / 10).toString());

const main = async (): Promise<void> => {
  console.info(`target ${target}: warming up…`);
  const version = await api<{ sha: string; version: string }>('GET', '/version');
  const data = await ensureDataset();
  console.info(
    `dataset: ${String(data.tournamentIds.length)} tournaments, ${String(data.finished.length)} finished matches`,
  );

  const rows: string[] = [];
  const raw: Record<string, Run[]> = {};
  for (const name of SCENARIOS) {
    const runs: Run[] = [];
    for (let i = 0; i < REPEATS; i++) {
      const run = await runOnce(scenario(name, data));
      console.info(
        `${name} #${String(i + 1)}: p50=${String(run.p50)} p95=${String(run.p95)} p99=${String(run.p99)} rps=${String(run.rps)} errors=${String(run.errors)}`,
      );
      runs.push(run);
    }
    raw[name] = runs;
    const p99s = runs.map((r) => r.p99);
    rows.push(
      `| ${name} | ${r1(median(runs.map((r) => r.p50)))} | ${r1(median(runs.map((r) => r.p95)))} | ${r1(median(p99s))} | ${r1(Math.min(...p99s))}–${r1(Math.max(...p99s))} | ${String(median(runs.map((r) => r.rps)))} | ${String(runs.reduce((s, r) => s + r.errors, 0))} | ${r1(median(runs.map((r) => r.loopP99)))} | ${r1(Math.max(...runs.map((r) => r.rssMb)))} |`,
    );
  }

  const sha7 = version.sha.slice(0, 7);
  const md = [
    `# Навантаження: ${LABEL} @ \`${sha7}\``,
    '',
    `Ціль: ${target} · версія ${version.version} · SHA \`${version.sha}\``,
    `autocannon: ${String(CONNECTIONS)} з'єднань × ${String(DURATION)} с × ${String(REPEATS)} повтори · дані: ${String(data.tournamentIds.length)} турнірів × ${String(TEAMS)} команд`,
    `Відтворення: \`npm run load -- ${target} --label=${LABEL}\``,
    '',
    'Медіана за повторами; латентність у мс (з часу кожного запиту); розкид — min–max p99 між повторами.',
    '',
    '| Сценарій | p50 | p95 | p99 | розкид p99 | RPS | помилки | event loop p99 | RSS, МБ |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');
  const dir = join('docs', 'perf');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${LABEL}-${sha7}.md`), md);
  await writeFile(
    join(dir, `${LABEL}-${sha7}.json`),
    JSON.stringify({ target, version, raw }, null, 2),
  );
  console.info(`\n${md}`);
};

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
