import { useMemo, useState } from 'react';
import type { Team, Transaction } from '../types';
import { useConfirm } from '../components/confirmContext';
import { DownloadIcon, XIcon } from '../components/icons';
import { NamePromptSheet } from '../components/NamePromptSheet';
import { TrendChart } from '../components/TrendChart';
import { formatSignedPoints } from '../lib/format';
import { placeMedal } from '../lib/placements';
import { summarizeByScorekeeper } from '../lib/scoring';
import { transactionsToCsv } from '../lib/csv';
import { todayKey } from '../lib/dates';
import { reverseTransaction } from '../lib/campRepo';

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
  campName,
  teams,
  transactions,
  multiplierFor,
  canEdit,
  scorekeeperName,
  onSetScorekeeperName,
}: {
  campId: string;
  campName: string;
  teams: Team[];
  transactions: Transaction[];
  multiplierFor: (ts: number) => number;
  canEdit: boolean;
  scorekeeperName: string;
  onSetScorekeeperName: (name: string) => void;
}) {
  const confirm = useConfirm();
  const [view, setView] = useState<'log' | 'trends'>('log');
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const teamColors = useMemo(() => new Map(teams.map((t) => [t.id, t.color])), [teams]);

  // Reversed entries stay in the log as an audit record but don't count toward
  // standings, trends, or the scorekeeper summary.
  const activeTransactions = useMemo(() => transactions.filter((t) => !t.reversedAt), [transactions]);

  // Finishing order per event, most-recent event first (for the Trends view).
  const eventSummary = useMemo(() => {
    const asc = activeTransactions
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
  }, [activeTransactions]);

  const scorekeeperSummary = useMemo(
    () => summarizeByScorekeeper(activeTransactions, multiplierFor),
    [activeTransactions, multiplierFor],
  );

  async function handleReverse(tx: Transaction) {
    if (tx.reversedAt) return;
    if (!scorekeeperName) {
      setShowNamePrompt(true);
      return;
    }
    const eff = tx.points * multiplierFor(tx.createdAt);
    const ok = await confirm({
      title: 'Reverse this entry?',
      message: `${formatSignedPoints(eff)} to ${tx.teamName} for "${tx.reason}" will be removed from their total. The entry stays in the log, marked reversed by you.`,
      confirmLabel: 'Reverse it',
      danger: true,
    });
    if (ok) reverseTransaction(campId, tx.id, scorekeeperName);
  }

  function exportCsv() {
    const csv = transactionsToCsv(transactions, teams, multiplierFor);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(campName || 'camp').replace(/[^\w-]+/g, '-')}-log-${todayKey()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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

      {transactions.length > 0 && (
        <button
          onClick={exportCsv}
          className="mb-1 ml-auto flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs font-bold text-ink-muted ring-1 ring-line transition active:scale-95"
        >
          <DownloadIcon className="h-3.5 w-3.5" />
          Export CSV
        </button>
      )}

      {view === 'trends' && (
        <div className="flex flex-col gap-5">
          <section>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-ink-faint">
              Points over time
            </h2>
            <div className="rounded-2xl bg-surface p-4 ring-1 ring-line">
              <TrendChart teams={teams} transactions={activeTransactions} multiplierFor={multiplierFor} />
            </div>
          </section>
          <section>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-ink-faint">
              By scorekeeper
            </h2>
            <div className="flex flex-col gap-2">
              {scorekeeperSummary.map((s) => (
                <div
                  key={s.name}
                  className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 ring-1 ring-line"
                >
                  <span className="min-w-0 flex-1 truncate font-semibold text-ink">{s.name}</span>
                  <span className="shrink-0 text-xs text-ink-faint">
                    {s.count} {s.count === 1 ? 'entry' : 'entries'}
                  </span>
                  <span className="shrink-0 text-sm font-black tabular-nums text-ink">
                    {formatSignedPoints(s.total)}
                  </span>
                </div>
              ))}
              {scorekeeperSummary.length === 0 && (
                <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-ink-faint">
                  Who awards points will show up here.
                </p>
              )}
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
        const reversed = Boolean(tx.reversedAt);
        const mult = multiplierFor(tx.createdAt);
        const eff = tx.points * mult;
        return (
        <div
          key={tx.id}
          className={`flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 ring-1 ring-line ${
            reversed ? 'opacity-55' : ''
          }`}
        >
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: teamColors.get(tx.teamId) ?? '#64748b' }}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-ink">{tx.teamName}</p>
            <p className="truncate text-sm text-ink-muted">{tx.reason}</p>
            <p className="text-xs text-ink-faint">
              {formatWhen(tx.createdAt)} · {tx.type === 'event' ? 'Event' : 'Manual'}
              {tx.awardedBy ? ` · ${tx.awardedBy}` : ''}
            </p>
            {reversed && (
              <p className="text-xs font-semibold text-danger">
                Reversed{tx.reversedBy ? ` by ${tx.reversedBy}` : ''}
              </p>
            )}
          </div>
          {mult === 2 && !reversed && (
            <span className="shrink-0 rounded-full bg-special/15 px-1.5 py-0.5 text-[10px] font-black text-special ring-1 ring-special/30">
              2×
            </span>
          )}
          <span
            className={`shrink-0 text-lg font-black tabular-nums ${
              reversed ? 'text-ink-faint line-through' : eff >= 0 ? 'text-positive' : 'text-danger'
            }`}
          >
            {formatSignedPoints(eff)}
          </span>
          {canEdit && !reversed && (
            <button
              onClick={() => handleReverse(tx)}
              className="shrink-0 p-1 text-ink-faint transition active:text-danger"
              aria-label="Reverse this entry"
            >
              <XIcon className="h-4 w-4" />
            </button>
          )}
        </div>
        );
      })}

      {showNamePrompt && (
        <NamePromptSheet
          onSave={(name) => {
            onSetScorekeeperName(name);
            setShowNamePrompt(false);
          }}
          onClose={() => setShowNamePrompt(false)}
        />
      )}
    </div>
  );
}
