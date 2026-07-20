import { describe, expect, it } from 'vitest';
import { transactionsToCsv } from './csv';
import type { Team, Transaction } from '../types';

function team(id: string, name: string): Team {
  return { id, name, color: '#000000', createdAt: 0 };
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
    createdAt: opts.createdAt ?? Date.UTC(2026, 6, 18, 12, 0, 0),
    ...opts,
  };
}

describe('transactionsToCsv', () => {
  it('emits a header plus one row per transaction', () => {
    const csv = transactionsToCsv([tx('a', 10, { awardedBy: 'Sam' })], [team('a', 'Eagles')], () => 1);
    const lines = csv.split('\n');
    expect(lines[0]).toBe(
      'Timestamp,Team,Points,Effective points,Reason,Type,Awarded by,Reversed,Reversed by',
    );
    expect(lines[1]).toBe('2026-07-18T12:00:00.000Z,Eagles,10,10,x,manual,Sam,no,');
  });

  it('applies the multiplier to effective points', () => {
    const csv = transactionsToCsv([tx('a', 10)], [team('a', 'Eagles')], () => 2);
    expect(csv.split('\n')[1]).toContain(',10,20,');
  });

  it('marks reversed entries and zeroes their effective points', () => {
    const csv = transactionsToCsv(
      [tx('a', 10, { reversedAt: 1, reversedBy: 'Ali' })],
      [team('a', 'Eagles')],
      () => 2,
    );
    const row = csv.split('\n')[1];
    expect(row).toContain(',10,0,');
    expect(row.endsWith('yes,Ali')).toBe(true);
  });

  it('quotes fields containing commas or quotes', () => {
    const csv = transactionsToCsv(
      [tx('a', 5, { reason: 'Cabin "A", bonus' })],
      [team('a', 'Eagles')],
      () => 1,
    );
    expect(csv.split('\n')[1]).toContain('"Cabin ""A"", bonus"');
  });
});
