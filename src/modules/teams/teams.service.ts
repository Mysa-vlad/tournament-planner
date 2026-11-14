import { DomainError, logger, newId, requireUserId, type Id } from '../../shared/index.js';
import type { Player, Team } from './teams.domain.js';
import type { TeamsRepository } from './teams.repository.js';

export interface TeamsService {
  createTeam(input: { name: string; city: string }): Promise<Team>;
  getTeam(id: Id): Promise<Team>;
  listTeams(): Promise<Team[]>;
  listPlayers(teamId: Id): Promise<Player[]>;
  addPlayer(teamId: Id, input: { fullName: string; number: number }): Promise<Player>;
}

/** spec D4: teams — листовий модуль, залежить лише від shared. */
export const createTeamsService = (repo: TeamsRepository): TeamsService => {
  const getTeam = async (id: Id): Promise<Team> => {
    const team = await repo.findById(id);
    if (!team) throw new DomainError('NOT_FOUND', `Team ${id} not found`);
    return team;
  };

  return {
    async createTeam({ name, city }) {
      requireUserId();
      const team: Team = { id: newId(), name: name.trim(), city: city.trim() };
      await repo.insert(team);
      logger.info({ teamId: team.id }, 'team created');
      return team;
    },
    getTeam,
    listTeams: () => repo.list(),
    async listPlayers(teamId) {
      await getTeam(teamId);
      return repo.listPlayers(teamId);
    },
    async addPlayer(teamId, { fullName, number }) {
      requireUserId();
      await getTeam(teamId);
      const roster = await repo.listPlayers(teamId);
      if (roster.some((p) => p.number === number)) {
        throw new DomainError('CONFLICT', `Number ${String(number)} is already taken`);
      }
      const player: Player = { id: newId(), teamId, fullName: fullName.trim(), number };
      await repo.insertPlayer(player);
      return player;
    },
  };
};
