// spec-lab5 AC24: CPU-профіль під навантаженням L-MIX. Запуск: npm run profile
// Збирає застосунок, запускає node dist/server.js з CPU_PROFILE_DIR на файловій БД (PGlite),
// ганяє scripts/load.ts, зупиняє профіль через IPC і друкує топ функцій за self-time.
import { execFileSync, fork, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

interface CpuNode {
  id: number;
  callFrame: { functionName: string; url: string; lineNumber: number };
  hitCount?: number;
}
interface CpuProfile {
  nodes: CpuNode[];
  startTime: number;
  endTime: number;
  samples: number[];
}

const freePort = (): Promise<number> =>
  new Promise((resolve) => {
    const s = createServer();
    s.listen(0, () => {
      const a = s.address();
      const port = typeof a === 'object' && a ? a.port : 0;
      s.close(() => {
        resolve(port);
      });
    });
  });

const category = (url: string, fn: string): string => {
  if (fn === '(idle)') return 'простій (очікування I/O)';
  if (fn === '(garbage collector)') return 'GC';
  if (fn === '(program)') return 'рушій V8 / native';
  if (url.includes('@electric-sql')) return 'БД (PGlite, WASM)';
  if (url.includes('node_modules/express') || url.includes('node_modules/router')) return 'express';
  if (url.includes('node_modules/pino') || url.includes('thread-stream')) return 'логер';
  if (url.includes('node_modules')) return 'інші залежності';
  if (url.includes('/dist/')) return 'код застосунку';
  if (url.startsWith('node:') || url === '') return 'Node.js (ядро)';
  return 'інше';
};

const summarize = (p: CpuProfile): { top: string[]; cats: string[]; totalMs: number } => {
  const totalMs = (p.endTime - p.startTime) / 1000;
  const totalHits = p.nodes.reduce((s, n) => s + (n.hitCount ?? 0), 0) || 1;
  const byFn = new Map<string, number>();
  const byCat = new Map<string, number>();
  for (const n of p.nodes) {
    const hits = n.hitCount ?? 0;
    if (hits === 0) continue;
    const { functionName, url, lineNumber } = n.callFrame;
    const fn = functionName || '(anonymous)';
    const key = `${fn} — ${url ? `${basename(url)}:${String(lineNumber + 1)}` : '(native)'}`;
    byFn.set(key, (byFn.get(key) ?? 0) + hits);
    const cat = category(url.replace(/\\/g, '/'), fn);
    byCat.set(cat, (byCat.get(cat) ?? 0) + hits);
  }
  const pct = (h: number): string => `${(Math.round((h / totalHits) * 1000) / 10).toString()} %`;
  const top = [...byFn.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([k, h], i) => `| ${String(i + 1)} | \`${k.replace(/\|/g, '\\|')}\` | ${pct(h)} |`);
  const cats = [...byCat.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([c, h]) => `| ${c} | ${pct(h)} |`);
  return { top, cats, totalMs };
};

const main = async (): Promise<void> => {
  execFileSync('npm', ['run', 'build'], { stdio: 'inherit', shell: true });
  const port = await freePort();
  const dataDir = await mkdtemp(join(tmpdir(), 'tp-profile-'));
  const profileDir = join('reports', 'profile');
  const child = fork('dist/server.js', [], {
    env: {
      ...process.env,
      PORT: String(port),
      DATA_SOURCE: 'pg',
      DATABASE_URL: dataDir,
      LOG_LEVEL: 'warn',
      CPU_PROFILE_DIR: profileDir,
      GIT_SHA: execFileSync('git', ['rev-parse', 'HEAD']).toString().trim(),
    },
  });
  const url = `http://127.0.0.1:${String(port)}`;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${url}/health`)).ok) break;
    } catch {
      /* ще стартує */
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  const load = spawnSync(
    'npx',
    [
      'tsx',
      'scripts/load.ts',
      url,
      '--label=profile',
      '--repeats=1',
      '--scenarios=LMIX',
      '--duration=20',
    ],
    { stdio: 'inherit', shell: true },
  );
  if (load.status !== 0) throw new Error('load failed');

  const file = await new Promise<string>((resolve) => {
    child.on('message', (m: unknown) => {
      if (typeof m === 'object' && m !== null && 'file' in m) resolve(String(m.file));
    });
    child.send('stop-profile');
  });
  child.kill();
  await rm(dataDir, { recursive: true, force: true });

  const profile = JSON.parse(await readFile(file, 'utf8')) as CpuProfile;
  const { top, cats, totalMs } = summarize(profile);
  const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD']).toString().trim();
  const md = [
    `# CPU-профіль під L-MIX @ \`${sha}\` (локально, PGlite у процесі)`,
    '',
    `Відтворення: \`npm run profile\` · тривалість профілю ${String(Math.round(totalMs / 1000))} с (засів даних + 20 с L-MIX) · сирий профіль: \`${file.replace(/\\/g, '/')}\` (відкривається в Chrome DevTools → Performance)`,
    '',
    'Увага: PGlite працює в тому самому процесі, тож час БД тут — це CPU, а не очікування.',
    'На стейджі (PostgreSQL по мережі) цей час перетворюється на очікування I/O.',
    '',
    '## Частки за категоріями (self-time)',
    '',
    '| Категорія | Частка |',
    '| --- | --- |',
    ...cats,
    '',
    '## Топ-15 функцій (self-time)',
    '',
    '| # | Функція — файл:рядок | Частка |',
    '| --- | --- | --- |',
    ...top,
    '',
  ].join('\n');
  await mkdir(join('docs', 'perf'), { recursive: true });
  await writeFile(join('docs', 'perf', `profile-${sha}.md`), md);
  console.info(`\n${md}`);
};

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
