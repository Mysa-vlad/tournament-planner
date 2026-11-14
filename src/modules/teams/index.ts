export type { Team, Player } from './teams.domain.js';
export type { TeamsService } from './teams.service.js';
export { createTeamsService } from './teams.service.js';
export {
  createInMemoryTeamsRepository,
  type TeamsRepository,
  type TeamsSeed,
} from './teams.repository.js';
export { createTeamsRouter } from './teams.routes.js';
