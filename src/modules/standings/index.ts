// Модуль standings застосунку — тонкий шар над пакетом @tournament-planner/standings:
// HTTP-маршрут, мапінг помилок і дві реалізації порту StandingsSource.
export type { StandingRow, FinishedResult } from '@tournament-planner/standings';
export type { StandingsService } from './standings.service.js';
export { createStandingsService } from './standings.service.js';
export { createStandingsRouter } from './standings.routes.js';
export { createServicesStandingsSource } from './standings.services-source.js';
export { createPgStandingsSource } from './standings.pg.repository.js';
