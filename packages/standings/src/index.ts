// Публічна точка входу пакета (spec-lab5 D11: застосунок імпортує лише її).
export type {
  CacheEntry,
  Clock,
  FinishedResult,
  PointsRules,
  Standings,
  StandingsCache,
  StandingsDeps,
  StandingRow,
  StandingsSource,
  TeamRef,
  TournamentSnapshot,
} from './contract.js';
export { computeStandings, DEFAULT_POINTS } from './compute.js';
export { createMemoryCache, createStandings, systemClock } from './standings.js';
