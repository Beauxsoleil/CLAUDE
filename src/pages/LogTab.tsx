import { useMemo } from 'react';
import type { Team, Transaction } from '../types';
import { deleteTransaction } from '../lib/campRepo';

function formatWhen(ts: number) {
  const d = new Date(ts);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  if (sameDay) return time;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${time}`;
}

export function LogTab({
  campId,
  teams,
  transactions,
}: {
  campId: string;
  teams: Team[];
  transactions: Transaction[];
}) {
  const teamColors = useMemo(() => new Map(teams.map((t) => [t.id, t.color])), [teams]);

  async function handleDelete(tx: Transaction) {
    if (window.confirm(`Remove ${tx.points > 0 ? '+' : ''}${tx.points} to ${tx.teamName} (${tx.reason})? This reverses the points.`)) {
      await deleteTransaction(campId, tx.id);
    }
  }

  return (
    <div className="flex flex-col gap-2 p-4 pb-32">
      <h2 className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-500">
        Point history
      </h2>
      {transactions.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-center">
          <p className="text-3xl">📜</p>
          <p className="mt-2 text-sm text-slate-500">No points awarded yet — the full history will show up here.</p>
        </div>
      )}
      {transactions.map((tx) => (
        <div key={tx.id} className="flex items-center gap-3 rounded-2xl bg-slate-900 px-4 py-3 ring-1 ring-white/5">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: teamColors.get(tx.teamId) ?? '#64748b' }}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-slate-100">{tx.teamName}</p>
            <p className="truncate text-sm text-slate-400">{tx.reason}</p>
            <p className="text-xs text-slate-600">
              {formatWhen(tx.createdAt)} · {tx.type === 'event' ? 'Event' : 'Manual'}
            </p>
          </div>
          <span
            className={`shrink-0 text-lg font-black tabular-nums ${
              tx.points >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {tx.points >= 0 ? '+' : ''}
            {tx.points}
          </span>
          <button
            onClick={() => handleDelete(tx)}
            className="shrink-0 text-slate-600 transition active:text-red-400"
            aria-label="Undo this entry"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
