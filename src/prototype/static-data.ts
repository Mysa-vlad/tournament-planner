import type { Match } from '../modules/matches/index.js';
import type { TeamsSeed } from '../modules/teams/index.js';
import type { TournamentsSeed } from '../modules/tournaments/index.js';

/**
 * Прототип на статичних даних (spec-lab2 AC7, DATA_SOURCE=static).
 * Фіксовані id, щоб сценарії можна було пройти вручну одразу після старту.
 */
export const STATIC_ORGANIZER = 'organizer-1';

const team = (n: number, name: string, city: string): TeamsSeed['teams'][number] => ({
  id: `00000000-0000-4000-8000-00000000000${String(n)}`,
  name,
  city,
});

export const staticTeams: TeamsSeed = {
  teams: [
    team(1, 'Ракета', 'Київ'),
    team(2, 'Буревій', 'Київ'),
    team(3, 'Каштан', 'Ірпінь'),
    team(4, 'Дніпро-Юніор', 'Обухів'),
  ],
  players: [
    {
      id: '10000000-0000-4000-8000-000000000001',
      teamId: '00000000-0000-4000-8000-000000000001',
      fullName: 'Іван Коваль',
      number: 9,
    },
    {
      id: '10000000-0000-4000-8000-000000000002',
      teamId: '00000000-0000-4000-8000-000000000002',
      fullName: 'Олег Бондар',
      number: 1,
    },
  ],
};

export const staticTournaments: TournamentsSeed = {
  tournaments: [
    {
      id: '20000000-0000-4000-8000-000000000001',
      name: 'Кубок ФІОТ 2026',
      status: 'registration',
      startsOn: '2026-11-21',
      organizerId: STATIC_ORGANIZER,
    },
  ],
  entries: [1, 2, 3].map((n) => ({
    tournamentId: '20000000-0000-4000-8000-000000000001',
    teamId: `00000000-0000-4000-8000-00000000000${String(n)}`,
    registeredAt: '2026-11-01T10:00:00.000Z',
  })),
};

export const staticMatches: readonly Match[] = [];
