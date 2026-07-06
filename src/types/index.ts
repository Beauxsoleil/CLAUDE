export interface Camp {
  id: string;
  name: string;
  createdAt: number;
  /** Local-date keys (YYYY-MM-DD) on which all points count double. */
  doublePointDays?: string[];
}

export interface Team {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}

/**
 * 'flat'   — every team tapped gets the same `points`.
 * 'ranked' — teams get points by finishing place from `placePoints`
 *            (index 0 = 1st place, 1 = 2nd, …); places past the end get 0.
 */
export type ScoringMode = 'flat' | 'ranked';

export interface EventPreset {
  id: string;
  name: string;
  points: number;
  durationMin: number;
  scoringMode?: ScoringMode;
  placePoints?: number[];
  createdAt: number;
}

export type ScheduleStatus = 'pending' | 'active' | 'done';

export interface ScheduleItem {
  id: string;
  order: number;
  name: string;
  points: number;
  durationMin: number;
  presetId: string | null;
  scoringMode?: ScoringMode;
  placePoints?: number[];
  status: ScheduleStatus;
  startedAt: number | null;
  finishedAt: number | null;
  createdAt: number;
}

export type TransactionType = 'event' | 'manual';

export interface Transaction {
  id: string;
  teamId: string;
  teamName: string;
  points: number;
  reason: string;
  type: TransactionType;
  scheduleItemId: string | null;
  createdAt: number;
}
