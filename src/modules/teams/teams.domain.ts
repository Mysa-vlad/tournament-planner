import type { Id } from '../../shared/index.js';

export interface Team {
  readonly id: Id;
  readonly name: string;
  readonly city: string;
}

export interface Player {
  readonly id: Id;
  readonly teamId: Id;
  readonly fullName: string;
  readonly number: number;
}
