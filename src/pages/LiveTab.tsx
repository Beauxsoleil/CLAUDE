import { useEffect, useMemo, useRef, useState } from 'react';
import type { ScheduleItem } from '../types';
import type { Placement, TeamWithTotal } from '../hooks/useCampData';
import type { Tab } from '../App';
import { ExtraPointsModal } from '../components/ExtraPointsModal';
import { useConfirm } from '../components/ConfirmSheet';
import { CheckIcon, PlayIcon, PlusIcon, ScreenIcon, ZapIcon } from '../components/icons';
import { contrastText } from '../lib/colors';
import { placeMedal } from '../lib/placements';
import { formatPoints, formatSignedPoints } from '../lib/format';
import { celebrateAward } from '../lib/celebrate';
import {
  awardPoints,
  deleteTransaction,
  markScheduleItemDone,
  setActiveScheduleItem,
} from '../lib/campRepo';

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
  canEdit,
  onNavigate,
  onPresent,
}: {
  campId: string;
  teams: TeamWithTotal[];
  schedule: ScheduleItem[];
  activeScheduleItem: ScheduleItem | null;
  nextScheduleItem: ScheduleItem | null;
  isTodayDouble: boolean;
  eventPlacements: Map<string, Placement[]>;
  canEdit: boolean;
  onNavigate: (tab: Tab) => void;
  onPresent: () => void;
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

  // Ranked scoring: points depend on finishing place. The place a team would
  // get if tapped next is (# teams already awarded) + 1.
  const isRanked =
    activeScheduleItem?.scoringMode === 'ranked' &&
    (activeScheduleItem.placePoints?.length ?? 0) > 0;
  const placePoints = activeScheduleItem?.placePoints ?? [];
  const nextPlaceIndex = placeByTeam.size; // 0-based place for the next tap
  const pointsForNextTap = isRanked
    ? placePoints[nextPlaceIndex] ?? 0
    : activeScheduleItem?.points ?? 0;

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
        message: `They finished ${placeMedal(placeByTeam.get(team.id) ?? 1)} in "${activeScheduleItem.name}". Award another +${pointsForNextTap * multiplier}?`,
        confirmLabel: 'Award again',
      });
      if (!ok) return;
    }
    // Capture the place this tap represents before the award lands.
    const place = nextPlaceIndex + 1;
    const basePoints = pointsForNextTap;
    const txId = awardPoints(campId, {
      teamId: team.id,
      teamName: team.name,
      points: basePoints,
      reason: activeScheduleItem.name,
      type: 'event',
      scheduleItemId: activeScheduleItem.id,
    });
    const eff = basePoints * multiplier;
    celebrateAward([team.color], place === 1 || eff >= 1000);
    showUndoToast(
      `${isRanked ? `${placeMedal(place)} ` : ''}+${formatPoints(eff)}${isTodayDouble ? ' (2×)' : ''} to ${team.name}`,
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
    if (eff > 0) celebrateAward([team?.color ?? '#fbbf24'], eff >= 1000);
    showUndoToast(
      `${formatSignedPoints(eff)}${isTodayDouble ? ' (2×)' : ''} to ${team?.name ?? 'team'}`,
      txId,
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 pb-32">
      {/* Double point day banner */}
      {isTodayDouble && (
        <div className="flex items-center justify-center gap-2 rounded-2xl bg-special/15 px-4 py-2.5 ring-1 ring-special/40">
          <ZapIcon className="h-4 w-4 text-special" />
          <p className="text-sm font-bold text-special">
            Double point day — everything counts 2×
          </p>
          <ZapIcon className="h-4 w-4 text-special" />
        </div>
      )}

      {/* First-run guided checklist */}
      {canEdit && needsSetup && !activeScheduleItem && (
        <div className="rounded-3xl bg-surface p-5 ring-1 ring-line">
          <h2 className="text-xl font-bold text-ink">Let's get set up</h2>
          <p className="mt-1 text-sm text-ink-faint">Three quick steps and you're scoring.</p>
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
        <div className="rounded-3xl bg-gradient-to-br from-accent-hi to-accent-lo p-5 text-on-accent shadow-xl shadow-accent/20">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest opacity-70">Happening now</p>
            <span className="flex items-center gap-1.5 rounded-full bg-on-accent/90 px-2.5 py-1 text-xs font-bold text-accent">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              LIVE
            </span>
          </div>
          <h2 className="mt-2 text-3xl font-black leading-tight">{activeScheduleItem.name}</h2>
          {isRanked ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-bold opacity-80">
              {placePoints.map((pts, i) => (
                <span key={i} className="flex items-center gap-1 text-sm">
                  <span>{placeMedal(i + 1)}</span>
                  {formatPoints(pts * multiplier)}
                </span>
              ))}
              {isTodayDouble && (
                <span className="rounded-full bg-on-accent/15 px-2 py-0.5 text-xs font-black">2×</span>
              )}
            </div>
          ) : (
            <p className="mt-1 font-semibold opacity-80">
              {formatPoints(activeScheduleItem.points * multiplier)} pts to award
              {isTodayDouble && <span className="ml-1.5 rounded-full bg-on-accent/15 px-2 py-0.5 text-xs font-black">2×</span>}
            </p>
          )}

          <div className="mt-4">
            <div className="h-1.5 overflow-hidden rounded-full bg-on-accent/20">
              <div
                className={`h-full rounded-full transition-all duration-700 ${overTime ? 'bg-danger-strong' : 'bg-on-accent'}`}
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs font-semibold opacity-70">
              {overTime
                ? `${elapsedMin - activeScheduleItem.durationMin} min over the ~${activeScheduleItem.durationMin} min plan`
                : `${elapsedMin} min in · ~${activeScheduleItem.durationMin} min planned`}
            </p>
          </div>

          {canEdit && (
            <button
              onClick={finishActive}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-surface px-4 py-3 font-bold text-accent-text transition active:scale-[0.98]"
            >
              <CheckIcon className="h-4 w-4" />
              Mark event done
            </button>
          )}
        </div>
      ) : (
        !needsSetup && (
          <div className="rounded-3xl border border-dashed border-line p-6 text-center">
            <p className="text-ink-muted">No event is running right now.</p>
            {canEdit && nextScheduleItem ? (
              <button
                onClick={startNext}
                className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-br from-accent-hi to-accent-lo px-5 py-3 font-bold text-on-accent shadow-lg shadow-accent/20 transition active:scale-[0.98]"
              >
                <PlayIcon className="h-4 w-4" />
                Start "{nextScheduleItem.name}"
              </button>
            ) : canEdit ? (
              <p className="mt-2 text-sm text-ink-faint">
                All events are done — add more in the Schedule tab if the day isn't over!
              </p>
            ) : null}
          </div>
        )
      )}

      {nextScheduleItem && activeScheduleItem && (
        <p className="-mt-3 text-center text-sm text-ink-faint">
          Up next: <span className="font-semibold text-ink-muted">{nextScheduleItem.name}</span>
        </p>
      )}

      {/* Award points for active event */}
      {activeScheduleItem && teams.length > 0 && canEdit && (
        <section>
          <h3 className="mb-2.5 flex items-center justify-between text-xs font-bold uppercase tracking-widest text-ink-faint">
            <span>Tap teams in finishing order</span>
            {isRanked && placeByTeam.size < placePoints.length && (
              <span className="text-accent-text">next: +{formatPoints(pointsForNextTap * multiplier)}</span>
            )}
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
                      {place ? placeMedal(place) : `+${formatPoints(pointsForNextTap * multiplier)}`}
                    </span>
                  </div>
                  <span className="text-sm font-medium opacity-75">{formatPoints(team.total)} pts</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Leaderboard */}
      {teams.length > 0 && (
        <section>
          <h3 className="mb-2.5 flex items-center justify-between text-xs font-bold uppercase tracking-widest text-ink-faint">
            <span>Leaderboard</span>
            <button
              onClick={onPresent}
              className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-ink-muted ring-1 ring-line transition active:scale-95"
            >
              <ScreenIcon className="h-3.5 w-3.5" />
              Present
            </button>
          </h3>
          <div className="flex flex-col gap-2">
            {teams.map((team, i) => (
              <div key={team.id} className="rounded-2xl bg-surface px-4 py-3 ring-1 ring-line">
                <div className="flex items-center gap-3">
                  <span className="w-7 text-center text-base">
                    {i < 3 ? placeMedal(i + 1) : <span className="text-sm font-bold text-ink-faint">{i + 1}</span>}
                  </span>
                  <span className="flex-1 truncate font-semibold text-ink">{team.name}</span>
                  <span className="text-lg font-black tabular-nums text-ink">{formatPoints(team.total)}</span>
                </div>
                <div className="ml-10 mt-1.5 h-1 overflow-hidden rounded-full bg-surface2">
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
        <div className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-50 flex items-center justify-between gap-3 rounded-2xl bg-surface2 px-4 py-3 shadow-xl ring-1 ring-line">
          <span className="font-semibold text-ink">{toast.message}</span>
          <button onClick={undoLastAward} className="font-bold text-accent-text">
            Undo
          </button>
        </div>
      )}

      {teams.length > 0 && !toast && canEdit && (
        <button
          onClick={() => setShowExtra(true)}
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] right-4 z-40 flex items-center gap-1.5 rounded-full bg-gradient-to-br from-accent-hi to-accent-lo px-5 py-3.5 font-bold text-on-accent shadow-xl shadow-accent/30 transition active:scale-95"
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
        done ? 'bg-positive/10' : 'bg-surface2/60'
      }`}
    >
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-black ${
          done ? 'bg-positive text-on-accent' : 'bg-surface3 text-ink-muted'
        }`}
      >
        {done ? <CheckIcon className="h-4 w-4" /> : n}
      </span>
      <span className={`flex-1 font-semibold ${done ? 'text-positive' : 'text-ink'}`}>
        {label}
      </span>
      {!done && actionLabel && onAction && !locked && (
        <button
          onClick={onAction}
          className="shrink-0 rounded-xl bg-accent px-3.5 py-2 text-xs font-bold text-on-accent transition active:scale-95"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
