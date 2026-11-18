import {
  createStandings,
  type StandingRow,
  type StandingsDeps,
} from '@tournament-planner/standings';
import { DomainError, type Id } from '../../shared/index.js';

/** Фасад пакета для застосунку: мапить «турніру немає» в DomainError NOT_FOUND (→ 404). */
export interface StandingsService {
  getStandings(tournamentId: Id): Promise<readonly StandingRow[]>;
  /** spec-lab5 AC30: викликається після запису, що змінює таблицю */
  invalidate(tournamentId: Id): void;
}

export const createStandingsService = (deps: StandingsDeps): StandingsService => {
  const standings = createStandings(deps);
  return {
    async getStandings(tournamentId) {
      const rows = await standings.get(tournamentId);
      if (!rows) throw new DomainError('NOT_FOUND', `Tournament ${tournamentId} not found`);
      return rows;
    },
    invalidate(tournamentId) {
      standings.invalidate(tournamentId);
    },
  };
};
