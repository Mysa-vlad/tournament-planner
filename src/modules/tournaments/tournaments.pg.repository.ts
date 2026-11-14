import { sql, type Database } from '../../db/index.js';
import type { Tournament, TournamentEntry, TournamentStatus } from './tournaments.domain.js';
import type { TournamentsRepository } from './tournaments.repository.js';

interface TournamentRow {
  id: string;
  name: string;
  status: TournamentStatus;
  starts_on: string;
  organizer_id: string;
}
interface EntryRow {
  tournament_id: string;
  team_id: string;
  registered_at: Date;
}

const toTournament = (r: TournamentRow): Tournament => ({
  id: r.id,
  name: r.name,
  status: r.status,
  startsOn: r.starts_on,
  organizerId: r.organizer_id,
});
const toEntry = (r: EntryRow): TournamentEntry => ({
  tournamentId: r.tournament_id,
  teamId: r.team_id,
  registeredAt: r.registered_at.toISOString(),
});

const SELECT_TOURNAMENT = sql`SELECT id, name, status, starts_on::text AS starts_on, organizer_id FROM tournaments`;

/** spec D6: SQL — лише в репозиторії. */
export const createPgTournamentsRepository = (db: Database): TournamentsRepository => ({
  async findById(id) {
    const [row] = await db.query<TournamentRow>({
      text: `${SELECT_TOURNAMENT.text} WHERE id = $1`,
      values: [id],
    });
    return row && toTournament(row);
  },
  async list() {
    const rows = await db.query<TournamentRow>({
      text: `${SELECT_TOURNAMENT.text} ORDER BY starts_on DESC`,
      values: [],
    });
    return rows.map(toTournament);
  },
  async insert(t) {
    await db.query(sql`
      INSERT INTO tournaments (id, name, starts_on, status, organizer_id)
      VALUES (${t.id}, ${t.name}, ${t.startsOn}, ${t.status}, ${t.organizerId})`);
  },
  async listEntries(tournamentId) {
    const rows = await db.query<EntryRow>(sql`
      SELECT tournament_id, team_id, registered_at FROM tournament_entries
      WHERE tournament_id = ${tournamentId} ORDER BY registered_at, team_id`);
    return rows.map(toEntry);
  },
  // S1: ON CONFLICT DO NOTHING — ідемпотентно й без гонки «перевірив → вставив» (AC9)
  async insertEntryIfAbsent(entry) {
    const inserted = await db.query<EntryRow>(sql`
      INSERT INTO tournament_entries (tournament_id, team_id, registered_at)
      VALUES (${entry.tournamentId}, ${entry.teamId}, ${entry.registeredAt})
      ON CONFLICT (tournament_id, team_id) DO NOTHING
      RETURNING tournament_id, team_id, registered_at`);
    const created = inserted[0];
    if (created) return { entry: toEntry(created), created: true };
    const [existing] = await db.query<EntryRow>(sql`
      SELECT tournament_id, team_id, registered_at FROM tournament_entries
      WHERE tournament_id = ${entry.tournamentId} AND team_id = ${entry.teamId}`);
    return { entry: existing ? toEntry(existing) : entry, created: false };
  },
  // compare-and-set: рядок оновиться лише в одного з паралельних запитів
  async transitionStatus(id, from, to) {
    const rows = await db.query<{ id: string }>(sql`
      UPDATE tournaments SET status = ${to}
      WHERE id = ${id} AND status = ${from}
      RETURNING id`);
    return rows.length === 1;
  },
});
