export type { Match, MatchStatus, Pairing } from './matches.domain.js';
export { generateRoundRobin } from './matches.domain.js';
export type { MatchesService, MatchesDeps, ScheduledMatchView } from './matches.service.js';
export { createMatchesService } from './matches.service.js';
export { createInMemoryMatchesRepository, type MatchesRepository } from './matches.repository.js';
export { createMatchesRouter } from './matches.routes.js';
export { createPgMatchesRepository } from './matches.pg.repository.js';
