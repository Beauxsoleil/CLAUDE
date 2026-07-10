import { useEffect } from 'react';
import type { ScheduleItem } from '../types';
import type { TeamWithTotal } from '../hooks/useCampData';
import { contrastText } from '../lib/colors';
import { placeMedal } from '../lib/placements';
import { formatPoints } from '../lib/format';
import { XIcon, ZapIcon } from './icons';

/**
 * Full-screen leaderboard for casting to a TV / projecting at rally.
 * Reuses the already-sorted `teamsWithTotals`; bars animate via CSS as
 * scores change. Keeps the screen awake while open (where supported).
 */
export function ScoreboardView({
  teams,
  activeScheduleItem,
  isTodayDouble,
  onClose,
}: {
  teams: TeamWithTotal[];
  activeScheduleItem: ScheduleItem | null;
  isTodayDouble: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    // Keep the screen on while presenting (best-effort; unsupported on iOS Safari).
    let sentinel: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<typeof sentinel> } };
    nav.wakeLock?.request('screen').then((s) => { sentinel = s; }).catch(() => {});
    return () => {
      sentinel?.release().catch(() => {});
    };
  }, []);

  const maxTotal = Math.max(...teams.map((t) => t.total), 1);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-canvas p-[max(1.5rem,env(safe-area-inset-top))_1.5rem_1.5rem] text-ink">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-bold uppercase tracking-widest text-ink-faint">Standings</p>
          {activeScheduleItem ? (
            <h1 className="mt-1 flex items-center gap-3 text-3xl font-black leading-tight sm:text-5xl">
              <span className="truncate">{activeScheduleItem.name}</span>
              <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-sm font-bold text-on-accent">
                <span className="h-2 w-2 animate-pulse rounded-full bg-on-accent" />
                LIVE
              </span>
            </h1>
          ) : (
            <h1 className="mt-1 text-3xl font-black leading-tight sm:text-5xl">Leaderboard</h1>
          )}
          {isTodayDouble && (
            <p className="mt-2 flex items-center gap-1.5 text-sm font-bold text-special">
              <ZapIcon className="h-4 w-4" />
              Double point day
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded-full bg-surface p-3 text-ink-muted ring-1 ring-line transition active:scale-95"
          aria-label="Exit scoreboard"
        >
          <XIcon className="h-6 w-6" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-center gap-3 overflow-y-auto">
        {teams.map((team, i) => {
          const pct = Math.max(3, (team.total / maxTotal) * 100);
          return (
            <div key={team.id} className="flex items-center gap-4">
              <span className="w-10 shrink-0 text-center text-2xl font-black sm:text-3xl">
                {i < 3 ? placeMedal(i + 1) : <span className="text-ink-faint">{i + 1}</span>}
              </span>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-baseline justify-between gap-3">
                  <span className="truncate text-2xl font-extrabold sm:text-4xl">{team.name}</span>
                  <span className="shrink-0 text-2xl font-black tabular-nums sm:text-4xl">
                    {formatPoints(team.total)}
                  </span>
                </div>
                <div className="h-4 overflow-hidden rounded-full bg-surface2 sm:h-6">
                  <div
                    className="flex h-full items-center justify-end rounded-full pr-2 transition-all duration-700"
                    style={{ width: `${pct}%`, backgroundColor: team.color, color: contrastText(team.color) }}
                  />
                </div>
              </div>
            </div>
          );
        })}
        {teams.length === 0 && (
          <p className="text-center text-lg text-ink-faint">Add teams to see the scoreboard.</p>
        )}
      </div>
    </div>
  );
}
