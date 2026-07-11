import { describe, expect, it } from 'vitest';
import { computePlacements, computeTotals, makeMultiplier } from './scoring';
import type { Team, Transaction } from '../types';

function team(id: string): Team {
  return { id, name: id.toUpperCase(), color: '#000000', createdAt: 0 };
}

let seq = 0;
function tx(teamId: string, points: number, opts: Partial<Transaction> = {}): Transaction {
  seq += 1;
  return {
    id: `t${seq}`,
    teamId,
    teamName: teamId.toUpperCase(),
    points,
    reason: opts.reason ?? 'x',
    type: opts.type ?? 'manual',
    scheduleItemId: opts.scheduleItemId ?? null,
    createdAt: opts.createdAt ?? seq,
  };
}

describe('makeMultiplier', () => {
  it('doubles only on listed local days', () => {
    const ts = new Date(2026, 6, 10, 9, 0).getTime(); // July 10 2026, local
    const other = new Date(2026, 6, 11, 9, 0).getTime();
    const m = makeMultiplier(new Set(['2026-07-10']));
    expect(m(ts)).toBe(2);
    expect(m(other)).toBe(1);
    expect(makeMultiplier(new Set())(ts)).toBe(1);
  });
});

describe('computeTotals', () => {
  it('sums points and sorts highest first', () => {
    const teams = [team('a'), team('b')];
    const txs = [tx('a', 10), tx('b', 5), tx('a', 3)];
    const totals = computeTotals(teams, txs, () => 1);
    expect(totals.map((t) => [t.id, t.total])).toEqual([
      ['a', 13],
      ['b', 5],
    ]);
  });
  it('applies the multiplier', () => {
    const teams = [team('a')];
    const totals = computeTotals(teams, [tx('a', 10)], () => 2);
    expect(totals[0].total).toBe(20);
  });
  it('gives teams with no transactions a zero total', () => {
    const totals = computeTotals([team('a')], [], () => 1);
    expect(totals[0].total).toBe(0);
  });
});

describe('computePlacements', () => {
  // transactions arrive newest-first (Firestore desc order)
  it('assigns places by award order and ignores manual awards', () => {
    const desc = [
      tx('c', 1, { type: 'event', scheduleItemId: 'E1', createdAt: 3 }),
      tx('x', 99, { type: 'manual', scheduleItemId: null, createdAt: 2.5 }),
      tx('b', 1, { type: 'event', scheduleItemId: 'E1', createdAt: 2 }),
      tx('a', 1, { type: 'event', scheduleItemId: 'E1', createdAt: 1 }),
    ];
    expect(computePlacements(desc).get('E1')).toEqual([
      { teamId: 'a', place: 1 },
      { teamId: 'b', place: 2 },
      { teamId: 'c', place: 3 },
    ]);
  });
  it('dedupes repeat awards to the same team', () => {
    const desc = [
      tx('a', 1, { type: 'event', scheduleItemId: 'E1', createdAt: 2 }),
      tx('a', 1, { type: 'event', scheduleItemId: 'E1', createdAt: 1 }),
    ];
    expect(computePlacements(desc).get('E1')).toEqual([{ teamId: 'a', place: 1 }]);
  });
  it('shifts places up when an earlier award is undone', () => {
    const desc = [
      tx('c', 1, { type: 'event', scheduleItemId: 'E1', createdAt: 3 }),
      tx('a', 1, { type: 'event', scheduleItemId: 'E1', createdAt: 1 }),
    ]; // b removed
    expect(computePlacements(desc).get('E1')).toEqual([
      { teamId: 'a', place: 1 },
      { teamId: 'c', place: 2 },
    ]);
  });
});
