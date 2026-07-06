import { useEffect, useMemo, useRef, useState } from 'react';
import type { ScheduleItem } from '../types';
import type { Placement, TeamWithTotal } from '../hooks/useCampData';
import type { Tab } from '../App';
import { ExtraPointsModal } from '../components/ExtraPointsModal';
import { useConfirm } from '../components/ConfirmSheet';
import { CheckIcon, PlayIcon, PlusIcon, ZapIcon } from '../components/icons';
import { contrastText } from '../lib/colors';
import {
  awardPoints,
  deleteTransaction,
  markScheduleItemDone,
  setActiveScheduleItem,
} from '../lib/campRepo';

const RANK_BADGES = ['🥇', '🥈', '🥉'];

export function placeLabel(place: number): string {
  if (place <= 3) return RANK_BADGES[place - 1];
  const suffix = place === 21 ? 'st' : place === 22 ? 'nd' : place === 23 ? 'rd' : 'th';
  return `${place}${suffix}`;
}

interface UndoToast {
  message: string;
  txId: string;
}

export function LiveTab({
  campId,
  teams,
  schedule,
  activeScheduleItem,
  nextScheduleItem,
  isTodayDouble,
  eventPlacements,
  onNavigate,
}: {
  campId: string;
  teams: TeamWithTotal[];
  schedule: ScheduleItem[];
  activeScheduleItem: ScheduleItem | null;
  nextScheduleItem: ScheduleItem | null;
  isTodayDouble: boolean;
  eventPlacements: Map<string, Placement[]>;
  onNavigate: (tab: Tab) => void;
}) {
  const confirm = useConfirm();
  const [showExtra, setShowExtra] = useState(false);
  const [toast, setToast] = useState<UndoToast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-render every 30s so the elapsed-time readout stays current.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Finishing order for the active event, shared across devices via the
  // transaction log (first award = 1st place).
  const placeByTeam = useMemo(() => {
    if (!activeScheduleItem) return new Map<string, number>();
    const placements = eventPlacements.get(activeScheduleItem.id) ?? [];
    return new Map(placements.map((p) => [p.teamId, p.place]));
  }, [eventPlacements, activeScheduleItem]);

  const maxTotal = Math.max(...teams.map((t) => t.total), 1);
  const needsSetup = teams.length === 0 || schedule.length === 0;
  const multiplier = isTodayDouble ? 2 : 1;

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
    deleteTransaction(campId, txId);
  }

  function startNext() {
    if (!nextScheduleItem) return;
    setActiveScheduleItem(campId, schedule, nextScheduleItem.id);
  }

  function finishActive() {
    if (!activeScheduleItem) return;
    markScheduleItemDone(campId, activeScheduleItem.id);
  }

  async function awardForActiveEvent(team: TeamWithTotal) {
    if (!activeScheduleItem) return;
    if (placeByTeam.has(team.id)) {
      const ok = await confirm({
        title: `${team.name} already got points`,
        message: `They finished ${placeLabel(placeByTeam.get(team.id) ?? 1)} in "${activeScheduleItem.name}". Award another +${activeScheduleItem.points * multiplier}?`,
        confirmLabel: 'Award again',
      });
      if (!ok) return;
    }
    const txId = awardPoints(campId, {
      teamId: team.id,
      teamName: team.name,
      points: activeScheduleItem.points,
      reason: activeScheduleItem.name,
      type: 'event',
      scheduleItemId: activeScheduleItem.id,
    });
    showUndoToast(
      `+${activeScheduleItem.points * multiplier}${isTodayDouble ? ' (2×)' : ''} to ${team.name}`,
      txId,
    );
  }

  function awardExtra(teamId: string, points: number, reason: string) {
    const team = teams.find((t) => t.id === teamId);
    const txId = awardPoints(campId, {
      teamId,
      teamName: team?.name ?? 'Team',
      points,
      reason,
      type: 'manual',
      scheduleItemId: null,
    });
    const eff = points * multiplier;
    showUndoToast(
      `${eff > 0 ? '+' : ''}${eff}${isTodayDouble ? ' (2×)' : ''} to ${team?.name ?? 'team'}`,
      txId,
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 pb-32">
      {/* Double point day banner */}
      {isTodayDouble && (
        <div className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500/20 via-fuchsia-500/20 to-violet-500/20 px-4 py-2.5 ring-1 ring-fuchsia-400/40">
          <ZapIcon className="h-4 w-4 text-fuchsia-300" />
          <p className="text-sm font-bold text-fuchsia-200">
            Double point day — everything counts 2×
          </p>
          <ZapIcon className="h-4 w-4 text-fuchsia-300" />
        </div>
      )}

      {/* First-run guided checklist */}
      {needsSetup && !activeScheduleItem && (
        <div className="rounded-3xl bg-slate-900 p-5 ring-1 ring-white/5">
          <h2 className="text-xl font-bold text-slate-100">Let's get set up</h2>
          <p className="mt-1 text-sm text-slate-500">Three quick steps and you're scoring.</p>
          <div className="mt-4 flex flex-col gap-2.5">
            <SetupStep
              n={1}
              done={teams.length > 0}
              label="Add your teams"
              actionLabel="Add teams"
              onAction={() => onNavigate('setup')}
            />
            <SetupStep
              n={2}
              done={schedule.length > 0}
              label="Plan today's events"
              actionLabel="Add events"
              onAction={() => onNavigate('schedule')}
            />
            <SetupStep
              n={3}
              done={false}
              label="Start your first event"
              actionLabel={nextScheduleItem ? 'Start now' : undefined}
              onAction={nextScheduleItem ? startNext : undefined}
              locked={!nextScheduleItem || teams.length === 0}
            />
          </div>
        </div>
      )}

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
          <p className="mt-1 font-semibold opacity-80">
            {activeScheduleItem.points * multiplier} pts to award
            {isTodayDouble && <span className="ml-1.5 rounded-full bg-slate-900/15 px-2 py-0.5 text-xs font-black">2×</span>}
          </p>

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
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 font-bold text-amber-300 transition active:scale-[0.98]"
          >
            <CheckIcon className="h-4 w-4" />
            Mark event done
          </button>
        </div>
      ) : (
        !needsSetup && (
          <div className="rounded-3xl border border-dashed border-slate-700 p-6 text-center">
            <p className="text-slate-400">No event is running right now.</p>
            {nextScheduleItem ? (
              <button
                onClick={startNext}
                className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-br from-amber-300 to-amber-500 px-5 py-3 font-bold text-slate-900 shadow-lg shadow-amber-500/20 transition active:scale-[0.98]"
              >
                <PlayIcon className="h-4 w-4" />
                Start "{nextScheduleItem.name}"
              </button>
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                All events are done — add more in the Schedule tab if the day isn't over!
              </p>
            )}
          </div>
        )
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
            Tap teams in finishing order
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {teams.map((team) => {
              const textColor = contrastText(team.color);
              const place = placeByTeam.get(team.id);
              const chipBg = textColor === '#ffffff' ? 'rgba(255,255,255,0.25)' : 'rgba(15,23,42,0.14)';
              return (
                <button
                  key={team.id}
                  onClick={() => awardForActiveEvent(team)}
                  className="flex select-none flex-col gap-2 rounded-2xl p-4 text-left shadow-lg transition active:scale-[0.96]"
                  style={{ backgroundColor: team.color, color: textColor }}
                >
                  <div className="flex w-full items-start justify-between gap-2">
                    <span className="min-w-0 truncate text-base font-extrabold leading-tight">{team.name}</span>
                    <span
                      className="flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-black"
                      style={{ backgroundColor: chipBg }}
                    >
                      {place ? placeLabel(place) : `+${activeScheduleItem.points * multiplier}`}
                    </span>
                  </div>
                  <span className="text-sm font-medium opacity-75">{team.total} pts</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Leaderboard */}
      {teams.length > 0 && (
        <section>
          <h3 className="mb-2.5 text-xs font-bold uppercase tracking-widest text-slate-500">
            Leaderboard
          </h3>
          <div className="flex flex-col gap-2">
            {teams.map((team, i) => (
              <div key={team.id} className="rounded-2xl bg-slate-900 px-4 py-3 ring-1 ring-white/5">
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
          </div>
        </section>
      )}

      {/* Undo toast */}
      {toast && (
        <div className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-50 flex items-center justify-between gap-3 rounded-2xl bg-slate-800 px-4 py-3 shadow-xl ring-1 ring-white/10">
          <span className="font-semibold text-slate-100">{toast.message}</span>
          <button onClick={undoLastAward} className="font-bold text-amber-300">
            Undo
          </button>
        </div>
      )}

      {teams.length > 0 && !toast && (
        <button
          onClick={() => setShowExtra(true)}
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] right-4 z-40 flex items-center gap-1.5 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 px-5 py-3.5 font-bold text-slate-900 shadow-xl shadow-amber-500/30 transition active:scale-95"
        >
          <PlusIcon className="h-4 w-4" />
          Extra points
        </button>
      )}

      {showExtra && (
        <ExtraPointsModal teams={teams} onClose={() => setShowExtra(false)} onAward={awardExtra} />
      )}
    </div>
  );
}

function SetupStep({
  n,
  done,
  label,
  actionLabel,
  onAction,
  locked = false,
}: {
  n: number;
  done: boolean;
  label: string;
  actionLabel?: string;
  onAction?: () => void;
  locked?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl px-3.5 py-3 ${
        done ? 'bg-emerald-400/10' : 'bg-slate-800/60'
      }`}
    >
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-black ${
          done ? 'bg-emerald-400 text-slate-900' : 'bg-slate-700 text-slate-300'
        }`}
      >
        {done ? <CheckIcon className="h-4 w-4" /> : n}
      </span>
      <span className={`flex-1 font-semibold ${done ? 'text-emerald-300' : 'text-slate-200'}`}>
        {label}
      </span>
      {!done && actionLabel && onAction && !locked && (
        <button
          onClick={onAction}
          className="shrink-0 rounded-xl bg-amber-400 px-3.5 py-2 text-xs font-bold text-slate-900 transition active:scale-95"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
