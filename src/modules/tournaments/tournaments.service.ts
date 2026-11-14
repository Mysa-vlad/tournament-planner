import { DomainError, logger, newId, requireUserId, type Id } from '../../shared/index.js';
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
  registerTeam(tournamentId: Id, teamId: Id): Promise<{ entry: TournamentEntry; created: boolean }>;
  listTeamIds(tournamentId: Id): Promise<Id[]>;
  /** доступ: лише організатор турніру (spec-lab2 §2) → інакше FORBIDDEN */
  assertOrganizer(tournamentId: Id): Promise<Tournament>;
  /** compare-and-set переходу статусу; false — якщо статус уже змінився (гонка) */
  tryTransition(tournamentId: Id, from: TournamentStatus, to: TournamentStatus): Promise<boolean>;
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
      const organizerId = requireUserId();
      const t: Tournament = {
        id: newId(),
        name: name.trim(),
        status: 'registration',
        startsOn,
        organizerId,
      };
      await repo.insert(t);
      logger.info({ tournamentId: t.id }, 'tournament created');
      return t;
    },
    get,
    list: () => repo.list(),

    // S1: заявка команди (ідемпотентно, AC9)
    async registerTeam(tournamentId, teamId) {
      requireUserId();
      const t = await get(tournamentId);
      if (t.status !== 'registration') {
        throw new DomainError('CONFLICT', 'Registration is closed');
      }
      await teams.getTeam(teamId);
      return repo.insertEntryIfAbsent({
        tournamentId,
        teamId,
        registeredAt: new Date().toISOString(),
      });
    },

    async listTeamIds(tournamentId) {
      return (await repo.listEntries(tournamentId)).map((e) => e.teamId);
    },

    async assertOrganizer(tournamentId) {
      const userId = requireUserId();
      const t = await get(tournamentId);
      if (t.organizerId !== userId) {
        throw new DomainError('FORBIDDEN', 'Only the tournament organizer can do this');
      }
      return t;
    },

    async tryTransition(tournamentId, from, to) {
      if (!canTransition(from, to)) {
        throw new DomainError('CONFLICT', `Cannot change status ${from} -> ${to}`);
      }
      return repo.transitionStatus(tournamentId, from, to);
    },
  };
};
