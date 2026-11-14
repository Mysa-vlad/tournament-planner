import type { Id } from '../../shared/index.js';
import type { Player, Team } from './teams.domain.js';

/** Контракт сховища: реалізації — in-memory (прототип) і PostgreSQL (teams.pg-repository.ts). */
export interface TeamsRepository {
  findById(id: Id): Promise<Team | undefined>;
  list(): Promise<Team[]>;
  insert(team: Team): Promise<void>;
  listPlayers(teamId: Id): Promise<Player[]>;
  /** кидає DomainError CONFLICT, якщо номер у команді вже зайнятий */
  insertPlayer(player: Player): Promise<void>;
}

export interface TeamsSeed {
  readonly teams: readonly Team[];
  readonly players: readonly Player[];
}

export const createInMemoryTeamsRepository = (
  seed: TeamsSeed = { teams: [], players: [] },
): TeamsRepository => {
  const teams = new Map<Id, Team>(seed.teams.map((t) => [t.id, t]));
  const players = new Map<Id, Player>(seed.players.map((p) => [p.id, p]));
  return {
    findById: (id) => Promise.resolve(teams.get(id)),
    list: () => Promise.resolve([...teams.values()]),
    insert: (team) => {
      teams.set(team.id, team);
      return Promise.resolve();
    },
    listPlayers: (teamId) =>
      Promise.resolve([...players.values()].filter((p) => p.teamId === teamId)),
    insertPlayer: (player) => {
      players.set(player.id, player);
      return Promise.resolve();
    },
  };
};
