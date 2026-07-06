import { useState } from 'react';
import type { ScheduleItem } from '../types';
import type { TeamWithTotal } from '../hooks/useCampData';
import { ExtraPointsModal } from '../components/ExtraPointsModal';
import {
  awardPoints,
  markScheduleItemDone,
  setActiveScheduleItem,
} from '../lib/campRepo';

export function LiveTab({
  campId,
  teams,
  schedule,
  activeScheduleItem,
  nextScheduleItem,
}: {
  campId: string;
  teams: TeamWithTotal[];
  schedule: ScheduleItem[];
  activeScheduleItem: ScheduleItem | null;
  nextScheduleItem: ScheduleItem | null;
}) {
  const [showExtra, setShowExtra] = useState(false);
  const [awarded, setAwarded] = useState<Record<string, true>>({});

  async function startNext() {
    if (!nextScheduleItem) return;
    await setActiveScheduleItem(campId, schedule, nextScheduleItem.id);
  }

  async function finishActive() {
    if (!activeScheduleItem) return;
    await markScheduleItemDone(campId, activeScheduleItem.id);
    setAwarded({});
  }

  async function awardForActiveEvent(team: TeamWithTotal) {
    if (!activeScheduleItem) return;
    await awardPoints(campId, {
      teamId: team.id,
      teamName: team.name,
      points: activeScheduleItem.points,
      reason: activeScheduleItem.name,
      type: 'event',
      scheduleItemId: activeScheduleItem.id,
    });
    setAwarded((prev) => ({ ...prev, [team.id]: true }));
  }

  async function awardExtra(teamId: string, points: number, reason: string) {
    const team = teams.find((t) => t.id === teamId);
    await awardPoints(campId, {
      teamId,
      teamName: team?.name ?? 'Team',
      points,
      reason,
      type: 'manual',
      scheduleItemId: null,
    });
  }

  return (
    <div className="flex flex-col gap-5 p-4 pb-28">
      {/* Current event card */}
      {activeScheduleItem ? (
        <div className="rounded-2xl bg-amber-400 p-5 text-slate-900 shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wide opacity-70">Current event</p>
          <h2 className="mt-1 text-2xl font-extrabold">{activeScheduleItem.name}</h2>
          <p className="mt-1 font-semibold">{activeScheduleItem.points} pts to award</p>
          <button
            onClick={finishActive}
            className="mt-4 rounded-xl bg-slate-900 px-4 py-2 font-semibold text-amber-300 active:scale-[0.98]"
          >
            Mark event done
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-700 p-5 text-center">
          <p className="text-slate-400">No event is currently active.</p>
          {nextScheduleItem ? (
            <button
              onClick={startNext}
              className="mt-3 rounded-xl bg-amber-400 px-4 py-2 font-semibold text-slate-900 active:scale-[0.98]"
            >
              Start "{nextScheduleItem.name}"
            </button>
          ) : (
            <p className="mt-2 text-sm text-slate-500">Add events in the Schedule tab to get started.</p>
          )}
        </div>
      )}

      {nextScheduleItem && activeScheduleItem && (
        <p className="-mt-2 text-center text-sm text-slate-500">Up next: {nextScheduleItem.name}</p>
      )}

      {/* Award points for active event */}
      {activeScheduleItem && (
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Tap a team to award {activeScheduleItem.points} pts
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {teams.map((team) => (
              <button
                key={team.id}
                onClick={() => awardForActiveEvent(team)}
                className="flex flex-col items-start gap-1 rounded-2xl p-4 text-left text-slate-900 shadow active:scale-[0.97]"
                style={{ backgroundColor: team.color }}
              >
                <span className="font-bold">{team.name}</span>
                <span className="text-sm opacity-80">{team.total} pts total</span>
                {awarded[team.id] && (
                  <span className="mt-1 rounded-full bg-black/20 px-2 py-0.5 text-xs font-semibold">
                    ✓ awarded
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Leaderboard</h3>
        <div className="flex flex-col gap-2">
          {teams.map((team, i) => (
            <div
              key={team.id}
              className="flex items-center gap-3 rounded-xl bg-slate-900 px-4 py-3"
            >
              <span className="w-5 text-center font-bold text-slate-500">{i + 1}</span>
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: team.color }} />
              <span className="flex-1 font-medium text-slate-100">{team.name}</span>
              <span className="font-bold text-slate-100">{team.total}</span>
            </div>
          ))}
          {teams.length === 0 && (
            <p className="text-sm text-slate-500">Add teams in the Teams tab to see the leaderboard.</p>
          )}
        </div>
      </div>

      <button
        onClick={() => setShowExtra(true)}
        disabled={teams.length === 0}
        className="fixed bottom-24 right-4 z-40 rounded-full bg-amber-400 px-5 py-3 font-semibold text-slate-900 shadow-lg disabled:opacity-50"
      >
        + Extra points
      </button>

      {showExtra && (
        <ExtraPointsModal teams={teams} onClose={() => setShowExtra(false)} onAward={awardExtra} />
      )}
    </div>
  );
}
