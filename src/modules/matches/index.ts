export type { Match, MatchStatus, Pairing } from './matches.domain.js';
export { generateRoundRobin } from './matches.domain.js';
export type { MatchesService, ScheduledMatchView } from './matches.service.js';
export { createMatchesService } from './matches.service.js';
export { createInMemoryMatchesRepository, type MatchesRepository } from './matches.repository.js';
export { createMatchesRouter } from './matches.routes.js';
