import { useState } from 'react';
import type { EventPreset, ScheduleItem } from '../types';

export interface ScheduleItemFormValue {
  name: string;
  points: number;
  durationMin: number;
  presetId: string | null;
}

export function ScheduleItemModal({
  presets,
  initial,
  onClose,
  onSubmit,
}: {
  presets: EventPreset[];
  initial?: ScheduleItem | null;
  onClose: () => void;
  onSubmit: (value: ScheduleItemFormValue) => Promise<void>;
}) {
  const [presetId, setPresetId] = useState<string>(initial?.presetId ?? 'custom');
  const [name, setName] = useState(initial?.name ?? '');
  const [points, setPoints] = useState(initial?.points ?? 10);
  const [durationMin, setDurationMin] = useState(initial?.durationMin ?? 30);
  const [busy, setBusy] = useState(false);

  function applyPreset(id: string) {
    setPresetId(id);
    if (id === 'custom') return;
    const preset = presets.find((p) => p.id === id);
    if (preset) {
      setName(preset.name);
      setPoints(preset.points);
      setDurationMin(preset.durationMin);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await onSubmit({
        name: name.trim(),
        points,
        durationMin,
        presetId: presetId === 'custom' ? null : presetId,
      });
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
          {initial ? 'Edit event' : 'Add event to schedule'}
        </h2>

        {presets.length > 0 && !initial && (
          <div className="mb-4">
            <p className="mb-1.5 text-sm text-slate-400">Start from a preset</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => applyPreset('custom')}
                className={`rounded-full px-3.5 py-2 text-sm font-bold transition ${
                  presetId === 'custom'
                    ? 'bg-amber-400 text-slate-900'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                Custom
              </button>
              {presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  className={`rounded-full px-3.5 py-2 text-sm font-bold transition ${
                    presetId === p.id ? 'bg-amber-400 text-slate-900' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {p.name} · {p.points}
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="mb-3 block text-sm text-slate-400">
          Event name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Capture the Flag"
            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100 outline-none focus:border-amber-400"
          />
        </label>

        <div className="mb-4 flex gap-3">
          <label className="flex-1 text-sm text-slate-400">
            Points
            <input
              type="number" inputMode="numeric"
              value={points}
              onChange={(e) => setPoints(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100 outline-none focus:border-amber-400"
            />
          </label>
          <label className="flex-1 text-sm text-slate-400">
            ~Duration (min)
            <input
              type="number" inputMode="numeric"
              value={durationMin}
              onChange={(e) => setDurationMin(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100 outline-none focus:border-amber-400"
            />
          </label>
        </div>

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
            disabled={busy || !name.trim()}
            className="flex-1 rounded-2xl bg-amber-400 px-4 py-3.5 font-bold text-slate-900 transition active:scale-[0.98] disabled:opacity-40"
          >
            {busy ? 'Saving…' : initial ? 'Save changes' : 'Add to schedule'}
          </button>
        </div>
      </form>
    </div>
  );
}
