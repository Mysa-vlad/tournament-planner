import { DomainError, newId, type Id } from '../../shared/index.js';
import { type TournamentsService } from '../tournaments/index.js';
import type { Player, Team } from './teams.domain.js';
import type { TeamsRepository } from './teams.repository.js';

export interface TeamsService {
  createTeam(input: { name: string; city: string }): Promise<Team>;
  getTeam(id: Id): Promise<Team>;
  listTeams(): Promise<Team[]>;
  addPlayer(teamId: Id, input: { fullName: string; number: number }): Promise<Player>;
}

export const createTeamsService = (
  repo: TeamsRepository,
  tournaments: () => TournamentsService,
): TeamsService => {
  const getTeam = async (id: Id): Promise<Team> => {
    const team = await repo.findById(id);
    if (!team) throw new DomainError('NOT_FOUND', `Team ${id} not found`);
    return team;
  };

  return {
    async createTeam({ name, city }) {
      if (name.trim() === '') throw new DomainError('VALIDATION', 'Team name is required');
      const team: Team = { id: newId(), name: name.trim(), city: city.trim() };
      await repo.save(team);
      return team;
    },
    getTeam,
    listTeams: () => repo.list(),
    async addPlayer(teamId, { fullName, number }) {
      await getTeam(teamId);
      if (await tournaments().isTeamInActiveTournament(teamId)) {
        throw new DomainError('CONFLICT', 'Roster is frozen while the team plays a tournament');
      }
      const roster = await repo.listPlayers(teamId);
      if (roster.some((p) => p.number === number)) {
        throw new DomainError('CONFLICT', `Number ${String(number)} is already taken`);
      }
      const player: Player = { id: newId(), teamId, fullName, number };
      await repo.savePlayer(player);
      return player;
    },
  };
};
