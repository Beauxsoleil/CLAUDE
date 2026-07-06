import { useState } from 'react';
import type { TeamWithTotal } from '../hooks/useCampData';

export function ExtraPointsModal({
  teams,
  onClose,
  onAward,
}: {
  teams: TeamWithTotal[];
  onClose: () => void;
  onAward: (teamId: string, points: number, reason: string) => Promise<void>;
}) {
  const [teamId, setTeamId] = useState(teams[0]?.id ?? '');
  const [points, setPoints] = useState(10);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!teamId || points === 0) return;
    setBusy(true);
    try {
      await onAward(teamId, points, reason.trim() || 'Extra points');
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-md rounded-t-3xl bg-slate-900 p-5 pb-8"
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-700" />
        <h2 className="mb-4 text-lg font-bold text-slate-100">Award extra points</h2>

        <label className="mb-3 block text-sm text-slate-400">
          Team
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100"
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        <label className="mb-3 block text-sm text-slate-400">
          Points
          <div className="mt-1 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPoints((p) => p - 5)}
              className="h-12 w-12 rounded-xl border border-slate-700 text-xl text-slate-100"
            >
              −
            </button>
            <input
              type="number"
              value={points}
              onChange={(e) => setPoints(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-center text-xl text-slate-100"
            />
            <button
              type="button"
              onClick={() => setPoints((p) => p + 5)}
              className="h-12 w-12 rounded-xl border border-slate-700 text-xl text-slate-100"
            >
              +
            </button>
          </div>
        </label>

        <label className="mb-4 block text-sm text-slate-400">
          Reason
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Cabin cleanliness, sportsmanship, etc."
            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100"
          />
        </label>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-700 px-4 py-3 font-semibold text-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !teamId || points === 0}
            className="flex-1 rounded-xl bg-amber-400 px-4 py-3 font-semibold text-slate-900 disabled:opacity-50"
          >
            {busy ? 'Awarding…' : `Award ${points > 0 ? '+' : ''}${points}`}
          </button>
        </div>
      </form>
    </div>
  );
}
