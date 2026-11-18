import { sql, type Database } from '../../db/index.js';
import type { Match, MatchStatus } from './matches.domain.js';
import type { MatchesRepository } from './matches.repository.js';

interface MatchRow {
  id: string;
  tournament_id: string;
  round: number;
  home_team_id: string;
  away_team_id: string;
  status: MatchStatus;
  home_goals: number | null;
  away_goals: number | null;
}

const toMatch = (r: MatchRow): Match => ({
  id: r.id,
  tournamentId: r.tournament_id,
  round: r.round,
  homeTeamId: r.home_team_id,
  awayTeamId: r.away_team_id,
  status: r.status,
  homeGoals: r.home_goals,
  awayGoals: r.away_goals,
});

const COLUMNS =
  'id, tournament_id, round, home_team_id, away_team_id, status, home_goals, away_goals';

/** spec D6: SQL — лише в репозиторії. */
export const createPgMatchesRepository = (db: Database): MatchesRepository => ({
  async findById(id) {
    const [row] = await db.query<MatchRow>({
      text: `SELECT ${COLUMNS} FROM matches WHERE id = $1`,
      values: [id],
    });
    return row && toMatch(row);
  },
  async listByTournament(tournamentId) {
    const rows = await db.query<MatchRow>({
      text: `SELECT ${COLUMNS} FROM matches WHERE tournament_id = $1 ORDER BY round, id`,
      values: [tournamentId],
    });
    return rows.map(toMatch);
  },
  // один INSERT на весь розклад (unnest), а не N·(N−1)/2 окремих запитів
  async insertMany(list) {
    if (list.length === 0) return;
    await db.query(sql`
      INSERT INTO matches (id, tournament_id, round, home_team_id, away_team_id, status)
      SELECT id, tournament_id, round, home, away, 'scheduled'
      FROM unnest(
        ${list.map((m) => m.id)}::uuid[],
        ${list.map((m) => m.tournamentId)}::uuid[],
        ${list.map((m) => m.round)}::smallint[],
        ${list.map((m) => m.homeTeamId)}::uuid[],
        ${list.map((m) => m.awayTeamId)}::uuid[]
      ) AS t(id, tournament_id, round, home, away)`);
  },
  // S3: compare-and-set — результат записується рівно один раз
  async finishIfScheduled(id, homeGoals, awayGoals) {
    const [row] = await db.query<MatchRow>({
      text: `UPDATE matches SET status = 'finished', home_goals = $2, away_goals = $3
             WHERE id = $1 AND status = 'scheduled' RETURNING ${COLUMNS}`,
      values: [id, homeGoals, awayGoals],
    });
    return row && toMatch(row);
  },
  async countUnfinished(tournamentId) {
    const [row] = await db.query<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM matches
      WHERE tournament_id = ${tournamentId} AND status <> 'finished'`);
    return row?.n ?? 0;
  },
});
