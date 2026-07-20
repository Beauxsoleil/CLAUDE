import { useState } from 'react';
import type { EventPreset, ScoringMode } from '../types';
import type { TeamWithTotal } from '../hooks/useCampData';
import { TEAM_COLORS, contrastText } from '../lib/colors';
import { useConfirm } from '../components/confirmContext';
import { PlacePointsEditor, ScoringModeToggle } from '../components/ScoringControls';
import { CheckIcon, LockIcon, QrIcon, TvIcon, XIcon, ZapIcon } from '../components/icons';
import { QrModal } from '../components/QrModal';
import { formatDayKey, todayKey } from '../lib/dates';
import { placeMedal } from '../lib/placements';
import { formatPoints } from '../lib/format';
import { THEMES, type ThemeId } from '../hooks/useTheme';
import {
  addPreset,
  addTeam,
  deletePreset,
  deleteTeam,
  linkBoardCamp,
  publishBoardSnapshot,
  setCampPin,
  setDoublePointDay,
  unlinkBoardCamp,
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
  canEdit,
  campPin,
  scorekeeperName,
  onSetScorekeeperName,
  boardCampId,
  boardPublishedAt,
  onLock,
  onRequestUnlock,
  onLeave,
}: {
  campId: string;
  campName: string;
  teams: TeamWithTotal[];
  presets: EventPreset[];
  doubleDays: Set<string>;
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
  canEdit: boolean;
  campPin: string | undefined;
  scorekeeperName: string;
  onSetScorekeeperName: (name: string) => void;
  boardCampId: string | undefined;
  boardPublishedAt: number | undefined;
  onLock: () => void;
  onRequestUnlock: () => void;
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
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [showQr, setShowQr] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [nameInput, setNameInput] = useState(scorekeeperName);
  const [boardBusy, setBoardBusy] = useState(false);
  const [boardCopied, setBoardCopied] = useState(false);

  function saveScorekeeperName(e: React.FormEvent) {
    e.preventDefault();
    onSetScorekeeperName(nameInput);
  }

  function savePin(e: React.FormEvent) {
    e.preventDefault();
    if (pinInput.length === 4) {
      setCampPin(campId, pinInput);
      setPinInput('');
    }
  }

  async function clearPin() {
    const ok = await confirm({
      title: 'Remove scorekeeper PIN?',
      message: 'Viewer devices could then be unlocked by anyone, without a PIN.',
      confirmLabel: 'Remove PIN',
      danger: true,
    });
    if (ok) setCampPin(campId, null);
  }

  async function switchToViewer() {
    const ok = await confirm({
      title: 'Switch this device to viewer mode?',
      message: campPin
        ? 'Award and edit controls hide until you re-enter the scorekeeper PIN.'
        : 'Award and edit controls hide. Set a PIN first if you want to require it to switch back.',
      confirmLabel: 'Viewer mode',
    });
    if (ok) onLock();
  }

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

  function startRename(teamId: string, current: string) {
    setEditingTeamId(teamId);
    setEditingName(current);
  }

  function commitRename() {
    if (editingTeamId) {
      const name = editingName.trim();
      if (name) updateTeam(campId, editingTeamId, { name });
    }
    setEditingTeamId(null);
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

  async function setUpBoard() {
    setBoardBusy(true);
    try {
      await linkBoardCamp(campId, campName);
    } finally {
      setBoardBusy(false);
    }
  }

  async function updateBoard() {
    if (!boardCampId) return;
    setBoardBusy(true);
    try {
      await publishBoardSnapshot(campId, boardCampId, teams);
    } finally {
      setBoardBusy(false);
    }
  }

  async function copyBoardCode() {
    if (!boardCampId) return;
    try {
      await navigator.clipboard.writeText(boardCampId);
      setBoardCopied(true);
      setTimeout(() => setBoardCopied(false), 1500);
    } catch {
      // clipboard API unavailable; ignore
    }
  }

  async function removeBoard() {
    const ok = await confirm({
      title: 'Remove board display?',
      message:
        'The hardware board will stop updating. You can set it up again later, which creates a fresh board code.',
      confirmLabel: 'Remove board',
      danger: true,
    });
    if (ok) unlinkBoardCamp(campId);
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
        <button
          onClick={() => setShowQr(true)}
          className="mx-auto mt-3 flex items-center gap-1.5 rounded-full bg-surface2 px-4 py-2 text-sm font-bold text-ink-muted transition active:scale-95"
        >
          <QrIcon className="h-4 w-4" />
          Show join QR
        </button>
      </div>
      {showQr && <QrModal campId={campId} onClose={() => setShowQr(false)} />}

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

      {/* Viewer-mode notice (shown when this device is locked) */}
      {!canEdit && (
        <div className="flex items-center gap-3 rounded-2xl bg-surface p-4 ring-1 ring-line">
          <LockIcon className="h-5 w-5 shrink-0 text-ink-muted" />
          <div className="flex-1">
            <p className="font-semibold text-ink">Viewer mode</p>
            <p className="text-sm text-ink-faint">This device can watch but not change scores.</p>
          </div>
          <button
            onClick={onRequestUnlock}
            className="shrink-0 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-on-accent transition active:scale-95"
          >
            Unlock
          </button>
        </div>
      )}

      {canEdit && (
      <>
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
              {editingTeamId === team.id ? (
                <input
                  autoFocus
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setEditingTeamId(null);
                  }}
                  className="min-w-0 flex-1 rounded-lg border border-line bg-surface2 px-2 py-1 font-semibold text-ink outline-none focus:border-accent"
                />
              ) : (
                <button
                  onClick={() => startRename(team.id, team.name)}
                  className="min-w-0 flex-1 truncate text-left font-semibold text-ink"
                  aria-label={`Rename ${team.name}`}
                >
                  {team.name}
                </button>
              )}
              <span className="text-sm tabular-nums text-ink-faint">{formatPoints(team.total)} pts</span>
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
            <p className="text-sm text-ink-faint">
              No teams yet — add your first one above. Tap a team's name to rename it, or its dot to change color.
            </p>
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
                  ? `By place · ${placeMedal(1)}${formatPoints(preset.placePoints?.[0] ?? 0)}`
                  : `${formatPoints(preset.points)} pts`}{' '}
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

      {/* Scorekeeper name */}
      <section>
        <h2 className="mb-1 text-xs font-bold uppercase tracking-widest text-ink-faint">Scorekeeper name</h2>
        <p className="mb-2.5 text-sm text-ink-faint">
          Attached to points you award or deduct on this device, so the History log shows who did what.
        </p>
        <form onSubmit={saveScorekeeperName} className="flex gap-2 rounded-2xl bg-surface p-3 ring-1 ring-line">
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Your name"
            maxLength={40}
            className="min-w-0 flex-1 rounded-xl border border-line bg-surface2 px-4 py-3 text-ink outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={nameInput.trim() === scorekeeperName}
            className="shrink-0 rounded-xl bg-accent px-4 py-3 font-bold text-on-accent transition active:scale-95 disabled:opacity-40"
          >
            Save
          </button>
        </form>
      </section>

      {/* Scoring lock */}
      <section>
        <h2 className="mb-1 text-xs font-bold uppercase tracking-widest text-ink-faint">Scoring lock</h2>
        <p className="mb-2.5 text-sm text-ink-faint">
          Set a scorekeeper PIN, then switch spare/kid-facing devices to viewer mode so they can watch
          the scoreboard but can't change points.
        </p>
        <div className="flex flex-col gap-2 rounded-2xl bg-surface p-3 ring-1 ring-line">
          <form onSubmit={savePin} className="flex gap-2">
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
              placeholder={campPin ? 'Change PIN (4 digits)' : 'Set PIN (4 digits)'}
              className="min-w-0 flex-1 rounded-xl border border-line bg-surface2 px-4 py-3 tracking-[0.3em] text-ink outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={pinInput.length !== 4}
              className="shrink-0 rounded-xl bg-accent px-4 py-3 font-bold text-on-accent transition active:scale-95 disabled:opacity-40"
            >
              Save
            </button>
          </form>
          <div className="flex items-center gap-2">
            <span className="flex-1 text-sm text-ink-faint">
              {campPin ? 'PIN is set.' : 'No PIN set.'}
            </span>
            {campPin && (
              <button onClick={clearPin} className="text-sm font-semibold text-danger active:opacity-70">
                Remove PIN
              </button>
            )}
          </div>
          <button
            onClick={switchToViewer}
            className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-surface2 px-4 py-3 font-bold text-ink-muted transition active:scale-[0.98]"
          >
            <LockIcon className="h-4 w-4" />
            Switch this device to viewer mode
          </button>
        </div>
      </section>

      {/* Hardware board */}
      <section>
        <h2 className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-ink-faint">
          <TvIcon className="h-3.5 w-3.5" />
          Hardware board
        </h2>
        {!boardCampId ? (
          <>
            <p className="mb-2.5 text-sm text-ink-faint">
              Drive a physical scoreboard that only reveals new standings when you press "Update board" —
              great for rally reveals. Sets up a separate board code the display reads from.
            </p>
            <button
              onClick={setUpBoard}
              disabled={boardBusy}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3 font-bold text-on-accent transition active:scale-[0.98] disabled:opacity-40"
            >
              <TvIcon className="h-4 w-4" />
              {boardBusy ? 'Setting up…' : 'Set up board display'}
            </button>
          </>
        ) : (
          <div className="flex flex-col gap-3 rounded-2xl bg-surface p-4 ring-1 ring-line">
            <p className="text-sm text-ink-faint">
              Enter this code in the board's on-screen setup (the gear icon) so it reads from this display.
            </p>
            <button
              onClick={copyBoardCode}
              className="mx-auto rounded-2xl border border-accent/40 bg-accent/10 px-6 py-3 text-3xl font-black tracking-[0.3em] text-accent-text transition active:scale-[0.97]"
            >
              {boardCampId}
            </button>
            <p className="h-4 text-center text-xs text-accent-text">
              {boardCopied ? 'Copied to clipboard!' : 'Tap to copy'}
            </p>
            <button
              onClick={updateBoard}
              disabled={boardBusy}
              className="flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 font-bold text-on-accent transition active:scale-[0.98] disabled:opacity-40"
            >
              <TvIcon className="h-4 w-4" />
              {boardBusy ? 'Updating…' : 'Update board now'}
            </button>
            <div className="flex items-center gap-2">
              <span className="flex-1 text-sm text-ink-faint">
                {boardPublishedAt
                  ? `Last updated ${new Date(boardPublishedAt).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}`
                  : 'Not published yet — press "Update board now".'}
              </span>
              <button onClick={removeBoard} className="text-sm font-semibold text-danger active:opacity-70">
                Remove board
              </button>
            </div>
          </div>
        )}
      </section>
      </>
      )}

      <button
        onClick={handleLeave}
        className="mt-2 rounded-2xl border border-line px-4 py-3 text-ink-faint transition active:bg-surface"
      >
        Leave this camp
      </button>

      <p className="text-center text-xs text-ink-faint">Build {__BUILD_ID__} UTC</p>
    </div>
  );
}
