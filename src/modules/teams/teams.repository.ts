import type { Id } from '../../shared/index.js';
import type { Player, Team } from './teams.domain.js';

/** Контракт сховища. Завдання 2 додасть реалізацію з БД. */
export interface TeamsRepository {
  findById(id: Id): Promise<Team | undefined>;
  list(): Promise<Team[]>;
  save(team: Team): Promise<void>;
  listPlayers(teamId: Id): Promise<Player[]>;
  savePlayer(player: Player): Promise<void>;
}

export const createInMemoryTeamsRepository = (): TeamsRepository => {
  const teams = new Map<Id, Team>();
  const players = new Map<Id, Player>();
  return {
    findById: (id) => Promise.resolve(teams.get(id)),
    list: () => Promise.resolve([...teams.values()]),
    save: (team) => {
      teams.set(team.id, team);
      return Promise.resolve();
    },
    listPlayers: (teamId) =>
      Promise.resolve([...players.values()].filter((p) => p.teamId === teamId)),
    savePlayer: (player) => {
      players.set(player.id, player);
      return Promise.resolve();
    },
  };
};
