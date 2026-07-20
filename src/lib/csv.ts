import type { Team, Transaction } from '../types';

/** Quote a CSV field when it contains a comma, quote, or newline (RFC 4180). */
function csvField(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const HEADERS = [
  'Timestamp',
  'Team',
  'Points',
  'Effective points',
  'Reason',
  'Type',
  'Awarded by',
  'Reversed',
  'Reversed by',
];

/**
 * Build a CSV of the full transaction log (newest-first, as stored). Includes
 * reversed entries with a Reversed flag so the export doubles as an audit
 * record; `Effective points` applies the per-day multiplier.
 */
export function transactionsToCsv(
  transactions: Transaction[],
  teams: Team[],
  multiplierFor: (ts: number) => number,
): string {
  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  const rows = transactions.map((tx) => {
    const eff = tx.reversedAt ? 0 : tx.points * multiplierFor(tx.createdAt);
    return [
      new Date(tx.createdAt).toISOString(),
      teamName.get(tx.teamId) ?? tx.teamName,
      tx.points,
      eff,
      tx.reason,
      tx.type,
      tx.awardedBy ?? '',
      tx.reversedAt ? 'yes' : 'no',
      tx.reversedBy ?? '',
    ]
      .map(csvField)
      .join(',');
  });
  return [HEADERS.join(','), ...rows].join('\n');
}
