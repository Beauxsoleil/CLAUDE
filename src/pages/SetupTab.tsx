import { useState } from 'react';
import type { EventPreset, Team } from '../types';
import type { TeamWithTotal } from '../hooks/useCampData';
import {
  addPreset,
  addTeam,
  deletePreset,
  deleteTeam,
} from '../lib/campRepo';

const TEAM_COLORS = [
  '#f59e0b', '#ef4444', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6', '#f97316',
];

export function SetupTab({
  campId,
  campName,
  teams,
  presets,
  onLeave,
}: {
  campId: string;
  campName: string;
  teams: TeamWithTotal[] | Team[];
  presets: EventPreset[];
  onLeave: () => void;
}) {
  const [teamName, setTeamName] = useState('');
  const [presetName, setPresetName] = useState('');
  const [presetPoints, setPresetPoints] = useState(10);
  const [presetDuration, setPresetDuration] = useState(30);
  const [copied, setCopied] = useState(false);

  async function handleAddTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!teamName.trim()) return;
    const color = TEAM_COLORS[teams.length % TEAM_COLORS.length];
    await addTeam(campId, teamName.trim(), color);
    setTeamName('');
  }

  async function handleAddPreset(e: React.FormEvent) {
    e.preventDefault();
    if (!presetName.trim()) return;
    await addPreset(campId, presetName.trim(), presetPoints, presetDuration);
    setPresetName('');
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

  return (
    <div className="flex flex-col gap-6 p-4 pb-28">
      <div className="rounded-2xl bg-slate-900 p-5 text-center">
        <p className="text-sm text-slate-400">{campName}</p>
        <p className="text-xs uppercase tracking-wide text-slate-500">Camp code — share with other devices</p>
        <button
          onClick={copyCode}
          className="mt-2 rounded-xl border border-amber-400/50 bg-amber-400/10 px-6 py-3 text-3xl font-black tracking-[0.3em] text-amber-300"
        >
          {campId}
        </button>
        {copied && <p className="mt-1 text-xs text-amber-300">Copied!</p>}
      </div>

      <section>
        <h2 className="mb-2 text-lg font-bold text-slate-100">Teams</h2>
        <form onSubmit={handleAddTeam} className="mb-3 flex gap-2">
          <input
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="Team name"
            className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100"
          />
          <button type="submit" className="rounded-xl bg-amber-400 px-4 py-3 font-semibold text-slate-900">
            Add
          </button>
        </form>
        <div className="flex flex-col gap-2">
          {teams.map((team) => (
            <div key={team.id} className="flex items-center gap-3 rounded-xl bg-slate-900 px-4 py-3">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: team.color }} />
              <span className="flex-1 font-medium text-slate-100">{team.name}</span>
              <button
                onClick={() => deleteTeam(campId, team.id)}
                className="text-slate-500"
                aria-label="Delete team"
              >
                🗑
              </button>
            </div>
          ))}
          {teams.length === 0 && <p className="text-sm text-slate-500">No teams yet.</p>}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold text-slate-100">Event Presets</h2>
        <p className="mb-2 text-sm text-slate-500">
          Presets let you award consistent points for common events with one tap during the day.
        </p>
        <form onSubmit={handleAddPreset} className="mb-3 flex flex-col gap-2">
          <input
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="Preset name (e.g. Cabin Inspection)"
            className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100"
          />
          <div className="flex gap-2">
            <input
              type="number"
              value={presetPoints}
              onChange={(e) => setPresetPoints(Number(e.target.value))}
              placeholder="Points"
              className="w-1/2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100"
            />
            <input
              type="number"
              value={presetDuration}
              onChange={(e) => setPresetDuration(Number(e.target.value))}
              placeholder="Duration (min)"
              className="w-1/2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100"
            />
          </div>
          <button type="submit" className="rounded-xl bg-amber-400 px-4 py-3 font-semibold text-slate-900">
            Add preset
          </button>
        </form>
        <div className="flex flex-col gap-2">
          {presets.map((preset) => (
            <div key={preset.id} className="flex items-center gap-3 rounded-xl bg-slate-900 px-4 py-3">
              <span className="flex-1 font-medium text-slate-100">{preset.name}</span>
              <span className="text-sm text-slate-400">
                {preset.points} pts · ~{preset.durationMin} min
              </span>
              <button
                onClick={() => deletePreset(campId, preset.id)}
                className="text-slate-500"
                aria-label="Delete preset"
              >
                🗑
              </button>
            </div>
          ))}
          {presets.length === 0 && <p className="text-sm text-slate-500">No presets yet.</p>}
        </div>
      </section>

      <button onClick={onLeave} className="mt-4 rounded-xl border border-slate-700 px-4 py-3 text-slate-400">
        Leave this camp
      </button>
    </div>
  );
}
