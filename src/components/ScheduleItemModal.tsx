import { useState } from 'react';
import type { EventPreset, ScheduleItem, ScoringMode } from '../types';
import { PlacePointsEditor, ScoringModeToggle } from './ScoringControls';
import { placeMedal } from '../lib/placements';
import { clampInt } from '../lib/format';
import { BottomSheet } from './BottomSheet';

export interface ScheduleItemFormValue {
  name: string;
  points: number;
  durationMin: number;
  presetId: string | null;
  scoringMode: ScoringMode;
  placePoints: number[];
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
  onSubmit: (value: ScheduleItemFormValue) => void;
}) {
  const [presetId, setPresetId] = useState<string>(initial?.presetId ?? 'custom');
  const [name, setName] = useState(initial?.name ?? '');
  const [points, setPoints] = useState(initial?.points ?? 10);
  const [durationMin, setDurationMin] = useState(initial?.durationMin ?? 30);
  const [scoringMode, setScoringMode] = useState<ScoringMode>(initial?.scoringMode ?? 'flat');
  const [placePoints, setPlacePoints] = useState<number[]>(
    initial?.placePoints?.length ? initial.placePoints : [5000, 3000, 1000],
  );

  function applyPreset(id: string) {
    setPresetId(id);
    if (id === 'custom') return;
    const preset = presets.find((p) => p.id === id);
    if (preset) {
      setName(preset.name);
      setPoints(preset.points);
      setDurationMin(preset.durationMin);
      setScoringMode(preset.scoringMode ?? 'flat');
      if (preset.placePoints?.length) setPlacePoints(preset.placePoints);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      points,
      durationMin,
      presetId: presetId === 'custom' ? null : presetId,
      scoringMode,
      placePoints: scoringMode === 'ranked' ? placePoints : [],
    });
    onClose();
  }

  return (
    <BottomSheet
      onClose={onClose}
      label={initial ? 'Edit event' : 'Add event to schedule'}
      className="max-h-[90vh] overflow-y-auto"
    >
      <form onSubmit={submit}>
        <h2 className="mb-4 text-lg font-bold text-ink">
          {initial ? 'Edit event' : 'Add event to schedule'}
        </h2>

        {presets.length > 0 && !initial && (
          <div className="mb-4">
            <p className="mb-1.5 text-sm text-ink-muted">Start from a preset</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => applyPreset('custom')}
                className={`rounded-full px-3.5 py-2 text-sm font-bold transition ${
                  presetId === 'custom'
                    ? 'bg-accent text-on-accent'
                    : 'bg-surface2 text-ink-muted'
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
                    presetId === p.id ? 'bg-accent text-on-accent' : 'bg-surface2 text-ink-muted'
                  }`}
                >
                  {p.name} ·{' '}
                  {p.scoringMode === 'ranked' ? `${placeMedal(1)}${p.placePoints?.[0] ?? 0}` : p.points}
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="mb-3 block text-sm text-ink-muted">
          Event name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Capture the Flag"
            className="mt-1 w-full rounded-xl border border-line bg-surface2 px-4 py-3 text-ink outline-none focus:border-accent"
          />
        </label>

        <div className="mb-3">
          <ScoringModeToggle mode={scoringMode} onChange={setScoringMode} />
        </div>

        {scoringMode === 'flat' ? (
          <div className="mb-4 flex gap-3">
            <label className="flex-1 text-sm text-ink-muted">
              Points (each team)
              <input
                type="number" inputMode="numeric"
                value={points}
                onChange={(e) => setPoints(clampInt(Number(e.target.value)))}
                className="mt-1 w-full rounded-xl border border-line bg-surface2 px-4 py-3 text-ink outline-none focus:border-accent"
              />
            </label>
            <label className="flex-1 text-sm text-ink-muted">
              ~Duration (min)
              <input
                type="number" inputMode="numeric"
                value={durationMin}
                onChange={(e) => setDurationMin(clampInt(Number(e.target.value)))}
                className="mt-1 w-full rounded-xl border border-line bg-surface2 px-4 py-3 text-ink outline-none focus:border-accent"
              />
            </label>
          </div>
        ) : (
          <div className="mb-4 flex flex-col gap-3">
            <div>
              <p className="mb-1.5 text-sm text-ink-muted">Points by finishing place</p>
              <PlacePointsEditor value={placePoints} onChange={setPlacePoints} />
            </div>
            <label className="text-sm text-ink-muted">
              ~Duration (min)
              <input
                type="number" inputMode="numeric"
                value={durationMin}
                onChange={(e) => setDurationMin(clampInt(Number(e.target.value)))}
                className="mt-1 w-full rounded-xl border border-line bg-surface2 px-4 py-3 text-ink outline-none focus:border-accent"
              />
            </label>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-2xl bg-surface2 px-4 py-3.5 font-bold text-ink-muted transition active:scale-[0.98]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            className="flex-1 rounded-2xl bg-accent px-4 py-3.5 font-bold text-on-accent transition active:scale-[0.98] disabled:opacity-40"
          >
            {initial ? 'Save changes' : 'Add to schedule'}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
