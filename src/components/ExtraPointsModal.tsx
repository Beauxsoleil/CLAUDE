import { useState } from 'react';
import type { TeamWithTotal } from '../hooks/useCampData';
import { contrastText } from '../lib/colors';

const QUICK_AMOUNTS = [5, 10, 25, 50];

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
  const [amount, setAmount] = useState(10);
  const [mode, setMode] = useState<'award' | 'deduct'>('award');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const signedPoints = mode === 'deduct' ? -Math.abs(amount) : Math.abs(amount);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!teamId || amount === 0) return;
    setBusy(true);
    try {
      await onAward(teamId, signedPoints, reason.trim() || (mode === 'deduct' ? 'Deduction' : 'Extra points'));
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-md rounded-t-3xl bg-slate-900 p-5 pb-[max(2rem,env(safe-area-inset-bottom))] ring-1 ring-white/10"
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-700" />
        <h2 className="mb-4 text-lg font-bold text-slate-100">
          {mode === 'deduct' ? 'Deduct points' : 'Award extra points'}
        </h2>

        {/* Award / Deduct toggle */}
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-slate-800 p-1">
          <button
            type="button"
            onClick={() => setMode('award')}
            className={`rounded-xl py-2 text-sm font-bold transition ${
              mode === 'award' ? 'bg-amber-400 text-slate-900' : 'text-slate-400'
            }`}
          >
            Award
          </button>
          <button
            type="button"
            onClick={() => setMode('deduct')}
            className={`rounded-xl py-2 text-sm font-bold transition ${
              mode === 'deduct' ? 'bg-red-500 text-white' : 'text-slate-400'
            }`}
          >
            Deduct
          </button>
        </div>

        {/* Team picker chips */}
        <p className="mb-1.5 text-sm text-slate-400">Team</p>
        <div className="mb-4 grid grid-cols-2 gap-2">
          {teams.map((t) => {
            const selected = t.id === teamId;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTeamId(t.id)}
                className={`truncate rounded-xl px-3 py-2.5 text-sm font-bold transition ${
                  selected ? '' : 'bg-slate-800 text-slate-300'
                }`}
                style={selected ? { backgroundColor: t.color, color: contrastText(t.color) } : undefined}
              >
                {t.name}
              </button>
            );
          })}
        </div>

        {/* Amount */}
        <p className="mb-1.5 text-sm text-slate-400">Points</p>
        <div className="mb-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAmount((p) => Math.max(0, p - 5))}
            className="h-12 w-12 shrink-0 rounded-xl bg-slate-800 text-xl font-bold text-slate-100 transition active:scale-95"
          >
            −
          </button>
          <input
            type="number" inputMode="numeric"
            min={0}
            value={amount}
            onChange={(e) => setAmount(Math.abs(Number(e.target.value)))}
            className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-center text-2xl font-black tabular-nums text-slate-100 outline-none focus:border-amber-400"
          />
          <button
            type="button"
            onClick={() => setAmount((p) => p + 5)}
            className="h-12 w-12 shrink-0 rounded-xl bg-slate-800 text-xl font-bold text-slate-100 transition active:scale-95"
          >
            +
          </button>
        </div>
        <div className="mb-4 flex gap-2">
          {QUICK_AMOUNTS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setAmount(q)}
              className={`flex-1 rounded-xl py-2 text-sm font-bold transition ${
                amount === q ? 'bg-slate-700 text-slate-100' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {q}
            </button>
          ))}
        </div>

        <label className="mb-5 block text-sm text-slate-400">
          Reason
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Cabin cleanliness, sportsmanship, etc."
            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100 outline-none focus:border-amber-400"
          />
        </label>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-2xl bg-slate-800 px-4 py-3.5 font-bold text-slate-300 transition active:scale-[0.98]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !teamId || amount === 0}
            className={`flex-1 rounded-2xl px-4 py-3.5 font-bold transition active:scale-[0.98] disabled:opacity-40 ${
              mode === 'deduct' ? 'bg-red-500 text-white' : 'bg-amber-400 text-slate-900'
            }`}
          >
            {busy ? 'Saving…' : mode === 'deduct' ? `Deduct −${Math.abs(amount)}` : `Award +${Math.abs(amount)}`}
          </button>
        </div>
      </form>
    </div>
  );
}
