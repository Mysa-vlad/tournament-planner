import { DomainError, newId, type Id } from '../../shared/index.js';
import type { TeamsService } from '../teams/index.js';
import {
  canTransition,
  type Tournament,
  type TournamentEntry,
  type TournamentStatus,
} from './tournaments.domain.js';
import type { TournamentsRepository } from './tournaments.repository.js';

export interface TournamentsService {
  create(input: { name: string; startsOn: string }): Promise<Tournament>;
  get(id: Id): Promise<Tournament>;
  list(): Promise<Tournament[]>;
  registerTeam(tournamentId: Id, teamId: Id): Promise<TournamentEntry>;
  listTeamIds(tournamentId: Id): Promise<Id[]>;
  changeStatus(tournamentId: Id, to: TournamentStatus): Promise<Tournament>;
}

export const createTournamentsService = (
  repo: TournamentsRepository,
  teams: TeamsService,
): TournamentsService => {
  const get = async (id: Id): Promise<Tournament> => {
    const t = await repo.findById(id);
    if (!t) throw new DomainError('NOT_FOUND', `Tournament ${id} not found`);
    return t;
  };

  return {
    async create({ name, startsOn }) {
      if (name.trim() === '') throw new DomainError('VALIDATION', 'Tournament name is required');
      const t: Tournament = { id: newId(), name: name.trim(), status: 'registration', startsOn };
      await repo.save(t);
      return t;
    },
    get,
    list: () => repo.list(),
    // S1: заявка команди
    async registerTeam(tournamentId, teamId) {
      const t = await get(tournamentId);
      if (t.status !== 'registration') {
        throw new DomainError('CONFLICT', 'Registration is closed');
      }
      await teams.getTeam(teamId);
      const entries = await repo.listEntries(tournamentId);
      if (entries.some((e) => e.teamId === teamId)) {
        throw new DomainError('CONFLICT', 'Team is already registered');
      }
      const entry: TournamentEntry = {
        tournamentId,
        teamId,
        registeredAt: new Date().toISOString(),
      };
      await repo.saveEntry(entry);
      return entry;
    },
    async listTeamIds(tournamentId) {
      return (await repo.listEntries(tournamentId)).map((e) => e.teamId);
    },
    async changeStatus(tournamentId, to) {
      const t = await get(tournamentId);
      if (!canTransition(t.status, to)) {
        throw new DomainError('CONFLICT', `Cannot change status ${t.status} -> ${to}`);
      }
      const updated: Tournament = { ...t, status: to };
      await repo.save(updated);
      return updated;
    },
  };
};
