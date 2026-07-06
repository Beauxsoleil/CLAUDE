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

        {presets.length > 0 && (
          <label className="mb-3 block text-sm text-slate-400">
            Preset
            <select
              value={presetId}
              onChange={(e) => applyPreset(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100"
            >
              <option value="custom">Custom event</option>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.points} pts)
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="mb-3 block text-sm text-slate-400">
          Event name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Capture the Flag"
            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100"
          />
        </label>

        <div className="mb-4 flex gap-3">
          <label className="flex-1 text-sm text-slate-400">
            Points
            <input
              type="number"
              value={points}
              onChange={(e) => setPoints(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100"
            />
          </label>
          <label className="flex-1 text-sm text-slate-400">
            ~Duration (min)
            <input
              type="number"
              value={durationMin}
              onChange={(e) => setDurationMin(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100"
            />
          </label>
        </div>

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
            disabled={busy || !name.trim()}
            className="flex-1 rounded-xl bg-amber-400 px-4 py-3 font-semibold text-slate-900 disabled:opacity-50"
          >
            {busy ? 'Saving…' : initial ? 'Save changes' : 'Add to schedule'}
          </button>
        </div>
      </form>
    </div>
  );
}
