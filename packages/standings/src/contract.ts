// Публічний контракт пакета (spec-lab5 AC28). Пакет знає лише ці типи; реалізації портів
// (БД, кеш, годинник) дає застосунок при ініціалізації — пакет про них не знає (D10).

/** Команда в таблиці: лише те, що потрібно для рядка. */
export interface TeamRef {
  readonly id: string;
  readonly name: string;
}

/** Завершений матч — мінімальний вхід для таблиці (не весь Match застосунку). */
export interface FinishedResult {
  readonly homeTeamId: string;
  readonly awayTeamId: string;
  readonly homeGoals: number;
  readonly awayGoals: number;
}

/** Усе, з чого рахується таблиця одного турніру. */
export interface TournamentSnapshot {
  readonly teams: readonly TeamRef[];
  readonly results: readonly FinishedResult[];
}

export interface StandingRow {
  readonly teamId: string;
  readonly teamName: string;
  readonly played: number;
  readonly won: number;
  readonly drawn: number;
  readonly lost: number;
  readonly goalsFor: number;
  readonly goalsAgainst: number;
  readonly goalDiff: number;
  readonly points: number;
}

/** Правила нарахування очок (S4: 3 / 1 / 0 за замовчуванням). */
export interface PointsRules {
  readonly win: number;
  readonly draw: number;
  readonly loss: number;
}

/** Порт «звідки дані». undefined — турніру не існує. */
export interface StandingsSource {
  loadSnapshot(tournamentId: string): Promise<TournamentSnapshot | undefined>;
}

/** Запис кешу: обчислена таблиця і момент, до якого вона свіжа (мс годинника). */
export interface CacheEntry {
  readonly rows: readonly StandingRow[];
  readonly expiresAt: number;
}

/** Порт кешу. Реалізація може бути в пам'яті процесу чи зовнішньою. */
export interface StandingsCache {
  get(tournamentId: string): CacheEntry | undefined;
  set(tournamentId: string, entry: CacheEntry): void;
  delete(tournamentId: string): void;
  clear(): void;
}

/** Порт годинника: мс від довільної точки (у тестах — керований). */
export interface Clock {
  now(): number;
}

/** Залежності, які пакет отримує при ініціалізації (DI). */
export interface StandingsDeps {
  readonly source: StandingsSource;
  readonly rules?: PointsRules;
  /** без кешу таблиця рахується на кожне читання */
  readonly cache?: StandingsCache;
  readonly clock?: Clock;
  /** скільки мс таблиця в кеші вважається свіжою; 0 — кеш вимкнено */
  readonly ttlMs?: number;
}

export interface Standings {
  /** undefined — турніру не існує (мапінг у помилку — справа застосунку) */
  get(tournamentId: string): Promise<readonly StandingRow[] | undefined>;
  /** скинути таблицю турніру після запису, що її змінює; без аргументу — усі */
  invalidate(tournamentId?: string): void;
}
