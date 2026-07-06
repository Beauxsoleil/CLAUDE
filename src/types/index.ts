export interface Camp {
  id: string;
  name: string;
  createdAt: number;
}

export interface Team {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}

export interface EventPreset {
  id: string;
  name: string;
  points: number;
  durationMin: number;
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
