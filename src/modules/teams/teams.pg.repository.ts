import { isUniqueViolation, sql, type Database } from '../../db/index.js';
import { DomainError, type Id } from '../../shared/index.js';
import type { Player, Team } from './teams.domain.js';
import type { TeamsRepository } from './teams.repository.js';

interface PlayerRow {
  id: string;
  team_id: string;
  full_name: string;
  number: number;
}

const toPlayer = (r: PlayerRow): Player => ({
  id: r.id,
  teamId: r.team_id,
  fullName: r.full_name,
  number: r.number,
});

/** spec D6: SQL — лише в репозиторії. */
export const createPgTeamsRepository = (db: Database): TeamsRepository => ({
  async findById(id) {
    const [row] = await db.query<Team>(sql`SELECT id, name, city FROM teams WHERE id = ${id}`);
    return row;
  },
  list: () => db.query<Team>(sql`SELECT id, name, city FROM teams ORDER BY name`),
  async insert(team) {
    await db.query(
      sql`INSERT INTO teams (id, name, city) VALUES (${team.id}, ${team.name}, ${team.city})`,
    );
  },
  async listPlayers(teamId: Id) {
    const rows = await db.query<PlayerRow>(
      sql`SELECT id, team_id, full_name, number FROM players WHERE team_id = ${teamId} ORDER BY number`,
    );
    return rows.map(toPlayer);
  },
  async insertPlayer(p) {
    try {
      await db.query(sql`
        INSERT INTO players (id, team_id, full_name, number)
        VALUES (${p.id}, ${p.teamId}, ${p.fullName}, ${p.number})`);
    } catch (err) {
      // гонка двох однакових запитів: перевірка в сервісі пройшла в обох, UNIQUE ловить другий
      if (isUniqueViolation(err)) {
        throw new DomainError('CONFLICT', `Number ${String(p.number)} is already taken`);
      }
      throw err;
    }
  },
});
