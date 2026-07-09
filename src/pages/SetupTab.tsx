import { useState } from 'react';
import type { EventPreset, ScoringMode } from '../types';
import type { TeamWithTotal } from '../hooks/useCampData';
import { TEAM_COLORS, contrastText } from '../lib/colors';
import { useConfirm } from '../components/ConfirmSheet';
import { PlacePointsEditor, ScoringModeToggle } from '../components/ScoringControls';
import { CheckIcon, XIcon, ZapIcon } from '../components/icons';
import { formatDayKey, todayKey } from '../lib/dates';
import { placeMedal } from '../lib/placements';
import { THEMES, type ThemeId } from '../hooks/useTheme';
import {
  addPreset,
  addTeam,
  deletePreset,
  deleteTeam,
  setDoublePointDay,
  updateTeam,
} from '../lib/campRepo';

export function SetupTab({
  campId,
  campName,
  teams,
  presets,
  doubleDays,
  theme,
  setTheme,
  onLeave,
}: {
  campId: string;
  campName: string;
  teams: TeamWithTotal[];
  presets: EventPreset[];
  doubleDays: Set<string>;
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
  onLeave: () => void;
}) {
  const confirm = useConfirm();
  const [teamName, setTeamName] = useState('');
  const [teamColor, setTeamColor] = useState<string | null>(null);
  const [presetName, setPresetName] = useState('');
  const [presetPoints, setPresetPoints] = useState(10);
  const [presetDuration, setPresetDuration] = useState(30);
  const [presetMode, setPresetMode] = useState<ScoringMode>('flat');
  const [presetPlacePoints, setPresetPlacePoints] = useState<number[]>([5000, 3000, 1000]);
  const [copied, setCopied] = useState(false);
  const [customDay, setCustomDay] = useState('');

  const today = todayKey();
  const isTodayDouble = doubleDays.has(today);
  const otherDoubleDays = [...doubleDays].filter((d) => d !== today).sort();

  const defaultColor = TEAM_COLORS[teams.length % TEAM_COLORS.length];
  const pickedColor = teamColor ?? defaultColor;

  async function handleAddTeam(e: React.FormEvent) {
    e.preventDefault();
    const name = teamName.trim();
    if (!name) return;
    // Clear immediately so quick back-to-back entries don't get wiped
    // by a state update landing after the user starts typing the next name.
    setTeamName('');
    setTeamColor(null);
    await addTeam(campId, name, pickedColor);
  }

  function cycleTeamColor(teamId: string, current: string) {
    const idx = TEAM_COLORS.indexOf(current);
    const next = TEAM_COLORS[(idx + 1) % TEAM_COLORS.length];
    void updateTeam(campId, teamId, { color: next });
  }

  async function handleDeleteTeam(teamId: string, name: string) {
    const ok = await confirm({
      title: `Remove ${name}?`,
      message: 'Their point history stays in the log, but they disappear from the leaderboard.',
      confirmLabel: 'Remove team',
      danger: true,
    });
    if (ok) await deleteTeam(campId, teamId);
  }

  function handleAddPreset(e: React.FormEvent) {
    e.preventDefault();
    const name = presetName.trim();
    if (!name) return;
    setPresetName('');
    addPreset(campId, {
      name,
      points: presetPoints,
      durationMin: presetDuration,
      scoringMode: presetMode,
      placePoints: presetMode === 'ranked' ? presetPlacePoints : [],
    });
  }

  async function handleDeletePreset(presetId: string, name: string) {
    const ok = await confirm({
      title: `Delete "${name}"?`,
      message: 'Events already on the schedule keep their points — only the reusable preset goes away.',
      confirmLabel: 'Delete preset',
      danger: true,
    });
    if (ok) await deletePreset(campId, presetId);
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(campId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API unavailable; ignore
    }
  }

  async function handleLeave() {
    const ok = await confirm({
      title: 'Leave this camp?',
      message: `Only this device disconnects — all the data stays saved. Rejoin anytime with the code ${campId}.`,
      confirmLabel: 'Leave camp',
      danger: true,
    });
    if (ok) onLeave();
  }

  return (
    <div className="flex flex-col gap-6 p-4 pb-32">
      {/* Camp code card */}
      <div className="rounded-3xl bg-surface p-5 text-center ring-1 ring-line">
        <p className="font-bold text-ink">{campName}</p>
        <p className="mt-0.5 text-xs uppercase tracking-widest text-ink-faint">
          Camp code · share with other devices
        </p>
        <button
          onClick={copyCode}
          className="mt-3 rounded-2xl border border-accent/40 bg-accent/10 px-6 py-3 text-3xl font-black tracking-[0.3em] text-accent-text transition active:scale-[0.97]"
        >
          {campId}
        </button>
        <p className="mt-2 h-4 text-xs text-accent-text">{copied ? 'Copied to clipboard!' : 'Tap to copy'}</p>
      </div>

      {/* Appearance / theme */}
      <section>
        <h2 className="mb-1 text-xs font-bold uppercase tracking-widest text-ink-faint">Appearance</h2>
        <p className="mb-2.5 text-sm text-ink-faint">
          Pick a look for this device. Everyone can choose their own.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {THEMES.map((t) => {
            const selected = theme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`relative flex flex-col gap-2 rounded-2xl p-3 text-left ring-1 transition active:scale-[0.98] ${
                  selected ? 'ring-2 ring-accent' : 'ring-line'
                }`}
                style={{ backgroundColor: t.swatch[0] }}
              >
                <div className="flex gap-1.5">
                  {t.swatch.map((c) => (
                    <span
                      key={c}
                      className="h-6 w-6 rounded-full ring-1 ring-black/10"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ color: t.swatch[2] }}>
                    {t.label}
                  </p>
                  <p className="text-xs" style={{ color: t.swatch[1] }}>
                    {t.hint}
                  </p>
                </div>
                {selected && (
                  <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-on-accent">
                    <CheckIcon className="h-3 w-3" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Double point days */}
      <section>
        <h2 className="mb-1 text-xs font-bold uppercase tracking-widest text-ink-faint">
          Double point days
        </h2>
        <p className="mb-2.5 text-sm text-ink-faint">
          Everything awarded on a 2× day counts double — flip it on or off anytime, even after
          points were given, and totals update everywhere instantly.
        </p>
        <div className="flex flex-col gap-2 rounded-2xl bg-surface p-3 ring-1 ring-line">
          <button
            onClick={() => setDoublePointDay(campId, today, !isTodayDouble)}
            className={`flex items-center justify-between rounded-xl px-4 py-3 font-bold transition active:scale-[0.98] ${
              isTodayDouble
                ? 'bg-special/15 text-special ring-1 ring-special/40'
                : 'bg-surface2 text-ink-muted'
            }`}
          >
            <span className="flex items-center gap-2">
              <ZapIcon className={`h-4 w-4 ${isTodayDouble ? 'text-special' : 'text-ink-faint'}`} />
              Today · {formatDayKey(today)}
            </span>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-black ${
                isTodayDouble ? 'bg-special text-on-accent' : 'bg-surface3 text-ink-muted'
              }`}
            >
              {isTodayDouble ? '2× ON' : 'OFF'}
            </span>
          </button>

          <div className="flex gap-2">
            <input
              type="date"
              value={customDay}
              onChange={(e) => setCustomDay(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-line bg-surface2 px-4 py-2.5 text-ink outline-none focus:border-accent"
            />
            <button
              onClick={() => {
                if (customDay) {
                  setDoublePointDay(campId, customDay, true);
                  setCustomDay('');
                }
              }}
              disabled={!customDay || doubleDays.has(customDay)}
              className="shrink-0 rounded-xl bg-surface3 px-4 py-2.5 text-sm font-bold text-ink transition active:scale-95 disabled:opacity-40"
            >
              Make 2×
            </button>
          </div>

          {otherDoubleDays.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {otherDoubleDays.map((d) => (
                <span
                  key={d}
                  className="flex items-center gap-1.5 rounded-full bg-special/10 px-3 py-1.5 text-xs font-bold text-special ring-1 ring-special/30"
                >
                  <ZapIcon className="h-3 w-3" />
                  {formatDayKey(d)}
                  <button
                    onClick={() => setDoublePointDay(campId, d, false)}
                    aria-label={`Remove double points on ${d}`}
                    className="ml-0.5 text-special/60 active:text-special"
                  >
                    <XIcon className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Teams */}
      <section>
        <h2 className="mb-2.5 text-xs font-bold uppercase tracking-widest text-ink-faint">Teams</h2>
        <form onSubmit={handleAddTeam} className="mb-3 rounded-2xl bg-surface p-3 ring-1 ring-line">
          <div className="flex gap-2">
            <input
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Team name"
              className="min-w-0 flex-1 rounded-xl border border-line bg-surface2 px-4 py-3 text-ink outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={!teamName.trim()}
              className="shrink-0 rounded-xl px-5 py-3 font-bold transition active:scale-95 disabled:opacity-40"
              style={{ backgroundColor: pickedColor, color: contrastText(pickedColor) }}
            >
              Add
            </button>
          </div>
          <div className="mt-2.5 flex justify-between px-1">
            {TEAM_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setTeamColor(c)}
                aria-label={`Team color ${c}`}
                className={`h-7 w-7 rounded-full transition active:scale-90 ${
                  pickedColor === c ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface' : ''
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </form>
        <div className="flex flex-col gap-2">
          {teams.map((team) => (
            <div key={team.id} className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 ring-1 ring-line">
              <button
                onClick={() => cycleTeamColor(team.id, team.color)}
                aria-label="Change team color"
                className="h-6 w-6 shrink-0 rounded-full transition active:scale-90"
                style={{ backgroundColor: team.color }}
              />
              <span className="flex-1 truncate font-semibold text-ink">{team.name}</span>
              <span className="text-sm tabular-nums text-ink-faint">{team.total} pts</span>
              <button
                onClick={() => handleDeleteTeam(team.id, team.name)}
                className="p-1 text-ink-faint transition active:text-danger"
                aria-label="Delete team"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
          {teams.length === 0 && (
            <p className="text-sm text-ink-faint">No teams yet — add your first one above. Tap a team's dot anytime to change its color.</p>
          )}
        </div>
      </section>

      {/* Event presets */}
      <section>
        <h2 className="mb-1 text-xs font-bold uppercase tracking-widest text-ink-faint">Event presets</h2>
        <p className="mb-2.5 text-sm text-ink-faint">
          Reusable events you can add to the schedule in one tap. Give everyone the same points, or
          award points by finishing place (e.g. 1st 5000, 2nd 3000…).
        </p>
        <form onSubmit={handleAddPreset} className="mb-3 flex flex-col gap-2.5 rounded-2xl bg-surface p-3 ring-1 ring-line">
          <input
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="Preset name (e.g. Cabin Inspection)"
            className="rounded-xl border border-line bg-surface2 px-4 py-3 text-ink outline-none focus:border-accent"
          />
          <ScoringModeToggle mode={presetMode} onChange={setPresetMode} />
          {presetMode === 'flat' ? (
            <div className="flex gap-2">
              <label className="flex-1 text-xs text-ink-faint">
                Points (each team)
                <input
                  type="number" inputMode="numeric"
                  value={presetPoints}
                  onChange={(e) => setPresetPoints(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-line bg-surface2 px-4 py-3 text-ink outline-none focus:border-accent"
                />
              </label>
              <label className="flex-1 text-xs text-ink-faint">
                ~Duration (min)
                <input
                  type="number" inputMode="numeric"
                  value={presetDuration}
                  onChange={(e) => setPresetDuration(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-line bg-surface2 px-4 py-3 text-ink outline-none focus:border-accent"
                />
              </label>
            </div>
          ) : (
            <>
              <div>
                <p className="mb-1.5 text-xs text-ink-faint">Points by finishing place</p>
                <PlacePointsEditor value={presetPlacePoints} onChange={setPresetPlacePoints} />
              </div>
              <label className="text-xs text-ink-faint">
                ~Duration (min)
                <input
                  type="number" inputMode="numeric"
                  value={presetDuration}
                  onChange={(e) => setPresetDuration(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-line bg-surface2 px-4 py-3 text-ink outline-none focus:border-accent"
                />
              </label>
            </>
          )}
          <button
            type="submit"
            disabled={!presetName.trim()}
            className="rounded-xl bg-accent px-4 py-3 font-bold text-on-accent transition active:scale-[0.98] disabled:opacity-40"
          >
            Add preset
          </button>
        </form>
        <div className="flex flex-col gap-2">
          {presets.map((preset) => (
            <div key={preset.id} className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 ring-1 ring-line">
              <span className="min-w-0 flex-1 truncate font-semibold text-ink">{preset.name}</span>
              <span className="shrink-0 text-sm text-ink-faint">
                {preset.scoringMode === 'ranked'
                  ? `By place · ${placeMedal(1)}${preset.placePoints?.[0] ?? 0}`
                  : `${preset.points} pts`}{' '}
                · ~{preset.durationMin}m
              </span>
              <button
                onClick={() => handleDeletePreset(preset.id, preset.name)}
                className="p-1 text-ink-faint transition active:text-danger"
                aria-label="Delete preset"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
          {presets.length === 0 && <p className="text-sm text-ink-faint">No presets yet.</p>}
        </div>
      </section>

      <button
        onClick={handleLeave}
        className="mt-2 rounded-2xl border border-line px-4 py-3 text-ink-faint transition active:bg-surface"
      >
        Leave this camp
      </button>
    </div>
  );
}
