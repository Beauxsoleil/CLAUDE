import { useMemo, useState } from 'react';
import type { Team, Transaction } from '../types';
import { useConfirm } from '../components/confirmContext';
import { XIcon } from '../components/icons';
import { TrendChart } from '../components/TrendChart';
import { formatSignedPoints } from '../lib/format';
import { placeMedal } from '../lib/placements';
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
  multiplierFor,
  canEdit,
}: {
  campId: string;
  teams: Team[];
  transactions: Transaction[];
  multiplierFor: (ts: number) => number;
  canEdit: boolean;
}) {
  const confirm = useConfirm();
  const [view, setView] = useState<'log' | 'trends'>('log');
  const teamColors = useMemo(() => new Map(teams.map((t) => [t.id, t.color])), [teams]);

  // Finishing order per event, most-recent event first (for the Trends view).
  const eventSummary = useMemo(() => {
    const asc = transactions
      .filter((t) => t.type === 'event' && t.scheduleItemId)
      .sort((a, b) => a.createdAt - b.createdAt);
    const map = new Map<string, { name: string; firstT: number; order: { teamId: string; teamName: string }[] }>();
    for (const tx of asc) {
      const key = tx.scheduleItemId as string;
      let e = map.get(key);
      if (!e) {
        e = { name: tx.reason, firstT: tx.createdAt, order: [] };
        map.set(key, e);
      }
      if (!e.order.some((o) => o.teamId === tx.teamId)) {
        e.order.push({ teamId: tx.teamId, teamName: tx.teamName });
      }
    }
    return [...map.values()].sort((a, b) => b.firstT - a.firstT);
  }, [transactions]);

  async function handleDelete(tx: Transaction) {
    const eff = tx.points * multiplierFor(tx.createdAt);
    const ok = await confirm({
      title: 'Reverse this entry?',
      message: `${formatSignedPoints(eff)} to ${tx.teamName} for "${tx.reason}" will be removed from their total.`,
      confirmLabel: 'Reverse it',
      danger: true,
    });
    if (ok) deleteTransaction(campId, tx.id);
  }

  return (
    <div className="flex flex-col gap-2 p-4 pb-32">
      <div className="mb-2 grid grid-cols-2 gap-1 rounded-2xl bg-surface2 p-1">
        <button
          onClick={() => setView('log')}
          className={`rounded-xl py-2 text-sm font-bold transition ${
            view === 'log' ? 'bg-accent text-on-accent' : 'text-ink-muted'
          }`}
        >
          Log
        </button>
        <button
          onClick={() => setView('trends')}
          className={`rounded-xl py-2 text-sm font-bold transition ${
            view === 'trends' ? 'bg-accent text-on-accent' : 'text-ink-muted'
          }`}
        >
          Trends
        </button>
      </div>

      {view === 'trends' && (
        <div className="flex flex-col gap-5">
          <section>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-ink-faint">
              Points over time
            </h2>
            <div className="rounded-2xl bg-surface p-4 ring-1 ring-line">
              <TrendChart teams={teams} transactions={transactions} multiplierFor={multiplierFor} />
            </div>
          </section>
          <section>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-ink-faint">
              By event
            </h2>
            <div className="flex flex-col gap-2">
              {eventSummary.map((e, i) => (
                <div key={i} className="rounded-2xl bg-surface px-4 py-3 ring-1 ring-line">
                  <p className="mb-1.5 truncate font-semibold text-ink">{e.name}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {e.order.slice(0, 3).map((o, j) => (
                      <span key={o.teamId} className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
                        <span>{placeMedal(j + 1)}</span>
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: teamColors.get(o.teamId) ?? '#64748b' }} />
                        {o.teamName}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {eventSummary.length === 0 && (
                <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-ink-faint">
                  Event results will appear here once you award points during an event.
                </p>
              )}
            </div>
          </section>
        </div>
      )}

      {view === 'log' && transactions.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line p-6 text-center">
          <p className="mt-2 text-sm text-ink-faint">
            No points awarded yet — every award shows up here, and any entry can be reversed with a tap.
          </p>
        </div>
      )}
      {view === 'log' && transactions.map((tx) => {
        const mult = multiplierFor(tx.createdAt);
        const eff = tx.points * mult;
        return (
        <div key={tx.id} className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 ring-1 ring-line">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: teamColors.get(tx.teamId) ?? '#64748b' }}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-ink">{tx.teamName}</p>
            <p className="truncate text-sm text-ink-muted">{tx.reason}</p>
            <p className="text-xs text-ink-faint">
              {formatWhen(tx.createdAt)} · {tx.type === 'event' ? 'Event' : 'Manual'}
            </p>
          </div>
          {mult === 2 && (
            <span className="shrink-0 rounded-full bg-special/15 px-1.5 py-0.5 text-[10px] font-black text-special ring-1 ring-special/30">
              2×
            </span>
          )}
          <span
            className={`shrink-0 text-lg font-black tabular-nums ${
              eff >= 0 ? 'text-positive' : 'text-danger'
            }`}
          >
            {formatSignedPoints(eff)}
          </span>
          {canEdit && (
            <button
              onClick={() => handleDelete(tx)}
              className="shrink-0 p-1 text-ink-faint transition active:text-danger"
              aria-label="Undo this entry"
            >
              <XIcon className="h-4 w-4" />
            </button>
          )}
        </div>
        );
      })}
    </div>
  );
}
