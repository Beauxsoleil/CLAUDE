import type { ScoringMode } from '../types';
import { ordinal } from '../lib/placements';
import { PlusIcon, XIcon } from './icons';

export function ScoringModeToggle({
  mode,
  onChange,
}: {
  mode: ScoringMode;
  onChange: (m: ScoringMode) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-800 p-1">
      <button
        type="button"
        onClick={() => onChange('flat')}
        className={`rounded-xl py-2 text-sm font-bold transition ${
          mode === 'flat' ? 'bg-amber-400 text-slate-900' : 'text-slate-400'
        }`}
      >
        Same for all
      </button>
      <button
        type="button"
        onClick={() => onChange('ranked')}
        className={`rounded-xl py-2 text-sm font-bold transition ${
          mode === 'ranked' ? 'bg-amber-400 text-slate-900' : 'text-slate-400'
        }`}
      >
        Points by place
      </button>
    </div>
  );
}

export function PlacePointsEditor({
  value,
  onChange,
}: {
  value: number[];
  onChange: (v: number[]) => void;
}) {
  function setAt(i: number, n: number) {
    const next = value.slice();
    next[i] = Math.max(0, n);
    onChange(next);
  }
  function addPlace() {
    const last = value[value.length - 1] ?? 0;
    onChange([...value, Math.max(0, Math.round(last / 2))]);
  }
  function removeAt(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  return (
    <div className="flex flex-col gap-2">
      {value.map((pts, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-14 shrink-0 text-sm font-bold text-slate-400">{ordinal(i + 1)}</span>
          <input
            type="number"
            inputMode="numeric"
            value={pts}
            onChange={(e) => setAt(i, Number(e.target.value))}
            className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-slate-100 outline-none focus:border-amber-400"
          />
          <button
            type="button"
            onClick={() => removeAt(i)}
            disabled={value.length <= 1}
            aria-label={`Remove ${ordinal(i + 1)} place`}
            className="p-2 text-slate-600 transition active:text-red-400 disabled:opacity-30"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addPlace}
        className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-800 py-2.5 text-sm font-bold text-slate-300 transition active:scale-[0.98]"
      >
        <PlusIcon className="h-4 w-4" />
        Add place
      </button>
    </div>
  );
}
