import { staticTeams, staticTournaments } from '../prototype/static-data.js';
import { logger } from '../shared/index.js';
import type { Database } from './contract.js';
import { sql } from './sql.js';

/**
 * spec-lab4 §4: seed — окрема команда (npm run db:seed), НЕ частина міграцій.
 * Демо-дані для стейджу; ідемпотентно (ON CONFLICT DO NOTHING), повторний запуск безпечний.
 */
export const seed = async (db: Database): Promise<void> => {
  await db.transaction(async () => {
    for (const t of staticTeams.teams) {
      await db.query(sql`INSERT INTO teams (id, name, city) VALUES (${t.id}, ${t.name}, ${t.city})
                         ON CONFLICT (id) DO NOTHING`);
    }
    for (const p of staticTeams.players) {
      await db.query(sql`INSERT INTO players (id, team_id, full_name, number)
                         VALUES (${p.id}, ${p.teamId}, ${p.fullName}, ${p.number})
                         ON CONFLICT DO NOTHING`);
    }
    for (const t of staticTournaments.tournaments) {
      await db.query(sql`INSERT INTO tournaments (id, name, starts_on, status, organizer_id)
                         VALUES (${t.id}, ${t.name}, ${t.startsOn}, ${t.status}, ${t.organizerId})
                         ON CONFLICT (id) DO NOTHING`);
    }
    for (const e of staticTournaments.entries) {
      await db.query(sql`INSERT INTO tournament_entries (tournament_id, team_id, registered_at)
                         VALUES (${e.tournamentId}, ${e.teamId}, ${e.registeredAt})
                         ON CONFLICT DO NOTHING`);
    }
  });
  logger.info('seed applied');
};
