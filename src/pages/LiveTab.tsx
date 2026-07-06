import { useEffect, useMemo, useRef, useState } from 'react';
import type { ScheduleItem, Transaction } from '../types';
import type { TeamWithTotal } from '../hooks/useCampData';
import { ExtraPointsModal } from '../components/ExtraPointsModal';
import { contrastText } from '../lib/colors';
import {
  awardPoints,
  deleteTransaction,
  markScheduleItemDone,
  setActiveScheduleItem,
} from '../lib/campRepo';

const RANK_BADGES = ['🥇', '🥈', '🥉'];

interface UndoToast {
  message: string;
  txId: string;
}

export function LiveTab({
  campId,
  teams,
  schedule,
  transactions,
  activeScheduleItem,
  nextScheduleItem,
}: {
  campId: string;
  teams: TeamWithTotal[];
  schedule: ScheduleItem[];
  transactions: Transaction[];
  activeScheduleItem: ScheduleItem | null;
  nextScheduleItem: ScheduleItem | null;
}) {
  const [showExtra, setShowExtra] = useState(false);
  const [toast, setToast] = useState<UndoToast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-render every 30s so the elapsed-time readout stays current.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Derived from the shared transaction log so every device sees the same
  // "already awarded" state for the active event.
  const awardedTeamIds = useMemo(() => {
    if (!activeScheduleItem) return new Set<string>();
    return new Set(
      transactions
        .filter((tx) => tx.scheduleItemId === activeScheduleItem.id)
        .map((tx) => tx.teamId),
    );
  }, [transactions, activeScheduleItem]);

  const maxTotal = Math.max(...teams.map((t) => t.total), 1);

  const elapsedMin = activeScheduleItem?.startedAt
    ? Math.max(0, Math.floor((now - activeScheduleItem.startedAt) / 60_000))
    : 0;
  const overTime = activeScheduleItem ? elapsedMin > activeScheduleItem.durationMin : false;
  const progress = activeScheduleItem
    ? Math.min(1, elapsedMin / Math.max(activeScheduleItem.durationMin, 1))
    : 0;

  function showUndoToast(message: string, txId: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, txId });
    toastTimer.current = setTimeout(() => setToast(null), 5_000);
  }

  async function undoLastAward() {
    if (!toast) return;
    if (toastTimer.current) clearTimeout(toastTimer.current);
    const { txId } = toast;
    setToast(null);
    await deleteTransaction(campId, txId);
  }

  async function startNext() {
    if (!nextScheduleItem) return;
    await setActiveScheduleItem(campId, schedule, nextScheduleItem.id);
  }

  async function finishActive() {
    if (!activeScheduleItem) return;
    await markScheduleItemDone(campId, activeScheduleItem.id);
  }

  async function awardForActiveEvent(team: TeamWithTotal) {
    if (!activeScheduleItem) return;
    if (
      awardedTeamIds.has(team.id) &&
      !window.confirm(`${team.name} already got points for this event. Award again?`)
    ) {
      return;
    }
    const txId = await awardPoints(campId, {
      teamId: team.id,
      teamName: team.name,
      points: activeScheduleItem.points,
      reason: activeScheduleItem.name,
      type: 'event',
      scheduleItemId: activeScheduleItem.id,
    });
    showUndoToast(`+${activeScheduleItem.points} to ${team.name}`, txId);
  }

  async function awardExtra(teamId: string, points: number, reason: string) {
    const team = teams.find((t) => t.id === teamId);
    const txId = await awardPoints(campId, {
      teamId,
      teamName: team?.name ?? 'Team',
      points,
      reason,
      type: 'manual',
      scheduleItemId: null,
    });
    showUndoToast(`${points > 0 ? '+' : ''}${points} to ${team?.name ?? 'team'}`, txId);
  }

  return (
    <div className="flex flex-col gap-6 p-4 pb-32">
      {/* Current event card */}
      {activeScheduleItem ? (
        <div className="rounded-3xl bg-gradient-to-br from-amber-300 to-amber-500 p-5 text-slate-900 shadow-xl shadow-amber-500/20">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest opacity-70">Happening now</p>
            <span className="flex items-center gap-1.5 rounded-full bg-slate-900/90 px-2.5 py-1 text-xs font-bold text-amber-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300" />
              LIVE
            </span>
          </div>
          <h2 className="mt-2 text-3xl font-black leading-tight">{activeScheduleItem.name}</h2>
          <p className="mt-1 font-semibold opacity-80">{activeScheduleItem.points} pts to award</p>

          <div className="mt-4">
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-900/20">
              <div
                className={`h-full rounded-full transition-all duration-700 ${overTime ? 'bg-red-700' : 'bg-slate-900'}`}
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs font-semibold opacity-70">
              {overTime
                ? `${elapsedMin - activeScheduleItem.durationMin} min over the ~${activeScheduleItem.durationMin} min plan`
                : `${elapsedMin} min in · ~${activeScheduleItem.durationMin} min planned`}
            </p>
          </div>

          <button
            onClick={finishActive}
            className="mt-4 w-full rounded-2xl bg-slate-900 px-4 py-3 font-bold text-amber-300 transition active:scale-[0.98]"
          >
            Mark event done
          </button>
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-slate-700 p-6 text-center">
          <p className="text-3xl">⛺️</p>
          <p className="mt-2 text-slate-400">No event is running right now.</p>
          {nextScheduleItem ? (
            <button
              onClick={startNext}
              className="mt-4 rounded-2xl bg-gradient-to-br from-amber-300 to-amber-500 px-5 py-3 font-bold text-slate-900 shadow-lg shadow-amber-500/20 transition active:scale-[0.98]"
            >
              Start "{nextScheduleItem.name}" ▶
            </button>
          ) : (
            <p className="mt-2 text-sm text-slate-500">Add events in the Schedule tab to get started.</p>
          )}
        </div>
      )}

      {nextScheduleItem && activeScheduleItem && (
        <p className="-mt-3 text-center text-sm text-slate-500">
          Up next: <span className="font-semibold text-slate-300">{nextScheduleItem.name}</span>
        </p>
      )}

      {/* Award points for active event */}
      {activeScheduleItem && teams.length > 0 && (
        <section>
          <h3 className="mb-2.5 text-xs font-bold uppercase tracking-widest text-slate-500">
            Tap a team · +{activeScheduleItem.points} pts
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {teams.map((team) => {
              const textColor = contrastText(team.color);
              const awarded = awardedTeamIds.has(team.id);
              return (
                <button
                  key={team.id}
                  onClick={() => awardForActiveEvent(team)}
                  className="relative flex select-none flex-col items-start gap-0.5 overflow-hidden rounded-2xl p-4 text-left shadow-lg transition active:scale-[0.96]"
                  style={{ backgroundColor: team.color, color: textColor }}
                >
                  <span className="text-base font-extrabold leading-tight">{team.name}</span>
                  <span className="text-sm font-medium opacity-75">{team.total} pts</span>
                  {awarded && (
                    <span
                      className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-black"
                      style={{
                        backgroundColor: textColor,
                        color: team.color,
                      }}
                    >
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Leaderboard */}
      <section>
        <h3 className="mb-2.5 text-xs font-bold uppercase tracking-widest text-slate-500">
          Leaderboard
        </h3>
        <div className="flex flex-col gap-2">
          {teams.map((team, i) => (
            <div
              key={team.id}
              className="rounded-2xl bg-slate-900 px-4 py-3 ring-1 ring-white/5"
            >
              <div className="flex items-center gap-3">
                <span className="w-7 text-center text-base">
                  {RANK_BADGES[i] ?? <span className="text-sm font-bold text-slate-500">{i + 1}</span>}
                </span>
                <span className="flex-1 truncate font-semibold text-slate-100">{team.name}</span>
                <span className="text-lg font-black tabular-nums text-slate-100">{team.total}</span>
              </div>
              <div className="ml-10 mt-1.5 h-1 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(0, (team.total / maxTotal) * 100)}%`,
                    backgroundColor: team.color,
                  }}
                />
              </div>
            </div>
          ))}
          {teams.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-center">
              <p className="text-3xl">🏳️</p>
              <p className="mt-2 text-sm text-slate-500">Add teams in the Setup tab to start the competition.</p>
            </div>
          )}
        </div>
      </section>

      {/* Undo toast */}
      {toast && (
        <div className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-50 flex items-center justify-between gap-3 rounded-2xl bg-slate-800 px-4 py-3 shadow-xl ring-1 ring-white/10">
          <span className="font-semibold text-slate-100">{toast.message}</span>
          <button onClick={undoLastAward} className="font-bold text-amber-300">
            Undo
          </button>
        </div>
      )}

      <button
        onClick={() => setShowExtra(true)}
        disabled={teams.length === 0}
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] right-4 z-40 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 px-5 py-3.5 font-bold text-slate-900 shadow-xl shadow-amber-500/30 transition active:scale-95 disabled:opacity-40"
        style={{ display: toast ? 'none' : undefined }}
      >
        + Extra points
      </button>

      {showExtra && (
        <ExtraPointsModal teams={teams} onClose={() => setShowExtra(false)} onAward={awardExtra} />
      )}
    </div>
  );
}
