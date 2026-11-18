import { describe, expect, test } from 'vitest';
import {
  createMemoryCache,
  createStandings,
  systemClock,
  type Clock,
  type StandingsSource,
  type TournamentSnapshot,
} from '../src/index.js';

// Тестові реалізації портів: пакет працює з будь-якими (spec-lab5 AC28, DI)
const snapshot: TournamentSnapshot = {
  teams: [
    { id: 'a', name: 'Alpha' },
    { id: 'b', name: 'Bravo' },
  ],
  results: [{ homeTeamId: 'a', awayTeamId: 'b', homeGoals: 1, awayGoals: 0 }],
};

const countingSource = (
  data: Record<string, TournamentSnapshot> = { t1: snapshot },
): StandingsSource & { calls: number } => {
  const src = {
    calls: 0,
    loadSnapshot(id: string): Promise<TournamentSnapshot | undefined> {
      src.calls += 1;
      return Promise.resolve(data[id]);
    },
  };
  return src;
};

const manualClock = (): Clock & { advance(ms: number): void } => {
  let t = 1_000;
  return {
    now: () => t,
    advance(ms) {
      t += ms;
    },
  };
};

describe('createStandings', () => {
  test('рахує таблицю з джерела; немає турніру → undefined', async () => {
    const standings = createStandings({ source: countingSource() });
    const rows = await standings.get('t1');
    expect(rows?.map((r) => [r.teamId, r.points])).toEqual([
      ['a', 3],
      ['b', 0],
    ]);
    expect(await standings.get('missing')).toBeUndefined();
  });

  test('без кешу (або ttlMs = 0) джерело читається на кожен виклик', async () => {
    const source = countingSource();
    const noCache = createStandings({ source });
    await noCache.get('t1');
    await noCache.get('t1');
    expect(source.calls).toBe(2);
    const zeroTtl = createStandings({ source, cache: createMemoryCache(), ttlMs: 0 });
    await zeroTtl.get('t1');
    await zeroTtl.get('t1');
    expect(source.calls).toBe(4);
    noCache.invalidate('t1'); // без кешу — нічого не ламає
    const ttlWithoutCache = createStandings({ source, ttlMs: 60_000 });
    await ttlWithoutCache.get('t1');
    await ttlWithoutCache.get('t1');
    expect(source.calls).toBe(6);
  });

  test('кеш: повтор у межах TTL не читає джерело; після TTL — читає', async () => {
    const source = countingSource();
    const clock = manualClock();
    const standings = createStandings({ source, cache: createMemoryCache(), clock, ttlMs: 100 });
    const first = await standings.get('t1');
    clock.advance(99);
    expect(await standings.get('t1')).toBe(first);
    expect(source.calls).toBe(1);
    clock.advance(1);
    await standings.get('t1');
    expect(source.calls).toBe(2);
  });

  test('invalidate(id) і invalidate() скидають кеш', async () => {
    const source = countingSource({ t1: snapshot, t2: snapshot });
    const standings = createStandings({ source, cache: createMemoryCache(), ttlMs: 60_000 });
    await standings.get('t1');
    await standings.get('t2');
    standings.invalidate('t1');
    await standings.get('t1');
    await standings.get('t2');
    expect(source.calls).toBe(3);
    standings.invalidate();
    await standings.get('t1');
    await standings.get('t2');
    expect(source.calls).toBe(5);
  });

  test('запис посеред читання: застаріла таблиця не потрапляє в кеш', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    const source: StandingsSource = {
      async loadSnapshot() {
        calls += 1;
        if (calls === 1) await gate; // перше читання «зависло» на старих даних
        return snapshot;
      },
    };
    const standings = createStandings({ source, cache: createMemoryCache(), ttlMs: 60_000 });
    const slow = standings.get('t1');
    standings.invalidate('t1'); // результат записано, поки читання ще йде
    release();
    await slow;
    await standings.get('t1');
    expect(calls).toBe(2);
  });

  test('не кешує «турніру немає»', async () => {
    const source = countingSource({});
    const standings = createStandings({ source, cache: createMemoryCache(), ttlMs: 60_000 });
    await standings.get('x');
    await standings.get('x');
    expect(source.calls).toBe(2);
  });
});

describe('createMemoryCache', () => {
  test('обмеження кількості: витісняє найстаріший запис', () => {
    const cache = createMemoryCache(2);
    const entry = { rows: [], expiresAt: 0 };
    cache.set('a', entry);
    cache.set('b', entry);
    cache.set('a', entry); // оновлення переносить «a» в кінець
    cache.set('c', entry);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe(entry);
    expect(cache.get('c')).toBe(entry);
    cache.clear();
    expect(cache.get('a')).toBeUndefined();
  });

  test('systemClock — реальний час', () => {
    const before = Date.now();
    expect(systemClock.now()).toBeGreaterThanOrEqual(before);
  });
});
