import { dayKey } from './dates';
import type { Team, Transaction } from '../types';

export interface TeamWithTotal extends Team {
  total: number;
}

export interface Placement {
  teamId: string;
  place: number;
}

/** Returns a multiplier function: 2 on a double-point day, 1 otherwise.
 *  Applied at read time so a day can be toggled double retroactively. */
export function makeMultiplier(doubleDays: Set<string>) {
  return (ts: number) => (doubleDays.has(dayKey(ts)) ? 2 : 1);
}

/** Team totals (points × per-day multiplier), highest first. */
export function computeTotals(
  teams: Team[],
  transactions: Transaction[],
  multiplierFor: (ts: number) => number,
): TeamWithTotal[] {
  const totals = new Map<string, number>();
  for (const tx of transactions) {
    totals.set(tx.teamId, (totals.get(tx.teamId) ?? 0) + tx.points * multiplierFor(tx.createdAt));
  }
  return teams
    .map((t) => ({ ...t, total: totals.get(t.id) ?? 0 }))
    .sort((a, b) => b.total - a.total);
}

export interface ScorekeeperActivity {
  name: string;
  count: number;
  total: number;
}

/**
 * Points activity grouped by the scorekeeper who awarded each entry, highest
 * total first. Entries with no `awardedBy` are grouped under "Unattributed".
 * `total` applies the per-day multiplier so it matches the standings.
 */
export function summarizeByScorekeeper(
  transactions: Transaction[],
  multiplierFor: (ts: number) => number,
): ScorekeeperActivity[] {
  const byName = new Map<string, ScorekeeperActivity>();
  for (const tx of transactions) {
    const name = tx.awardedBy?.trim() || 'Unattributed';
    let entry = byName.get(name);
    if (!entry) {
      entry = { name, count: 0, total: 0 };
      byName.set(name, entry);
    }
    entry.count += 1;
    entry.total += tx.points * multiplierFor(tx.createdAt);
  }
  return [...byName.values()].sort((a, b) => b.total - a.total);
}

/**
 * Finishing order per event, derived from award order (first team awarded for
 * an event finished 1st, and so on). Undo-safe: deleting an award shifts the
 * places of everyone after it. `transactions` is expected newest-first (the
 * Firestore subscription order); it is walked oldest-first internally.
 */
export function computePlacements(transactions: Transaction[]): Map<string, Placement[]> {
  const byEvent = new Map<string, Placement[]>();
  for (let i = transactions.length - 1; i >= 0; i--) {
    const tx = transactions[i];
    if (tx.type !== 'event' || !tx.scheduleItemId) continue;
    let placements = byEvent.get(tx.scheduleItemId);
    if (!placements) {
      placements = [];
      byEvent.set(tx.scheduleItemId, placements);
    }
    if (!placements.some((p) => p.teamId === tx.teamId)) {
      placements.push({ teamId: tx.teamId, place: placements.length + 1 });
    }
  }
  return byEvent;
}
