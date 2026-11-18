import type { StandingsSource, TournamentSnapshot } from '@tournament-planner/standings';
import { sql, type Database } from '../../db/index.js';

/**
 * spec-lab5 AC29: read model таблиці — ОДИН запит замість чотирьох (турнір, заявки,
 * команди, усі матчі). Беруться лише завершені матчі. Виняток D2 (лише читання)
 * описано в spec-lab5 §5. Немає рядка — турніру не існує.
 */
export const createPgStandingsSource = (db: Database): StandingsSource => ({
  async loadSnapshot(tournamentId) {
    const [row] = await db.query<TournamentSnapshot>(sql`
      SELECT
        (SELECT coalesce(json_agg(json_build_object('id', tm.id, 'name', tm.name)), '[]'::json)
           FROM tournament_entries e JOIN teams tm ON tm.id = e.team_id
          WHERE e.tournament_id = t.id) AS teams,
        (SELECT coalesce(json_agg(json_build_object(
                  'homeTeamId', m.home_team_id, 'awayTeamId', m.away_team_id,
                  'homeGoals', m.home_goals, 'awayGoals', m.away_goals)), '[]'::json)
           FROM matches m
          WHERE m.tournament_id = t.id AND m.status = 'finished') AS results
      FROM tournaments t
      WHERE t.id = ${tournamentId}`);
    return row;
  },
});
