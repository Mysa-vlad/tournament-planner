import { computeStandings, DEFAULT_POINTS } from './compute.js';
import type { Clock, Standings, StandingsCache, StandingsDeps } from './contract.js';

export const systemClock: Clock = { now: () => Date.now() };

/** Найпростіша реалізація порту кешу: Map у пам'яті процесу з обмеженням кількості записів. */
export const createMemoryCache = (maxEntries = 1000): StandingsCache => {
  const map = new Map<string, Parameters<StandingsCache['set']>[1]>();
  return {
    get: (id) => map.get(id),
    set(id, entry) {
      map.delete(id);
      map.set(id, entry);
      // найстаріший за вставкою — першим у Map
      if (map.size > maxEntries) map.delete(map.keys().next().value as string);
    },
    delete: (id) => {
      map.delete(id);
    },
    clear: () => {
      map.clear();
    },
  };
};

/** Фабрика сервісу таблиці. Усі залежності — через параметри (DI). */
export const createStandings = ({
  source,
  rules = DEFAULT_POINTS,
  cache,
  clock = systemClock,
  ttlMs = 0,
}: StandingsDeps): Standings => {
  const useCache = cache !== undefined && ttlMs > 0;
  // Покоління: якщо між читанням джерела і записом у кеш стався invalidate,
  // обчислене за старими даними не потрапить у кеш.
  let generation = 0;

  return {
    async get(tournamentId) {
      const now = clock.now();
      if (useCache) {
        const hit = cache.get(tournamentId);
        if (hit && hit.expiresAt > now) return hit.rows;
      }
      const startedAt = generation;
      const snapshot = await source.loadSnapshot(tournamentId);
      if (!snapshot) return undefined;
      const rows = computeStandings(snapshot, rules);
      if (useCache && startedAt === generation) {
        cache.set(tournamentId, { rows, expiresAt: now + ttlMs });
      }
      return rows;
    },
    invalidate(tournamentId) {
      generation += 1;
      if (!cache) return;
      if (tournamentId === undefined) cache.clear();
      else cache.delete(tournamentId);
    },
  };
};
