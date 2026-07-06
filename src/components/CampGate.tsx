import { useState } from 'react';
import type { useCampSession } from '../hooks/useCampSession';

type Session = ReturnType<typeof useCampSession>;

export function CampGate({ session }: { session: Session }) {
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await session.create(name);
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await session.join(code);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-950 px-6 text-slate-100">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-96"
        style={{ background: 'radial-gradient(ellipse at top, rgba(251,191,36,0.14), transparent 65%)' }}
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-300 to-amber-500 text-4xl shadow-xl shadow-amber-500/25">
            🏕️
          </div>
          <h1 className="text-3xl font-black tracking-tight">Camp Points</h1>
          <p className="mt-2 text-sm text-slate-400">
            One live scoreboard for every event, on every counselor's phone.
          </p>
        </div>

        {mode === 'choose' && (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setMode('create')}
              className="rounded-2xl bg-gradient-to-br from-amber-300 to-amber-500 px-4 py-3.5 font-bold text-slate-900 shadow-lg shadow-amber-500/20 transition active:scale-[0.98]"
            >
              Start a new camp
            </button>
            <button
              onClick={() => setMode('join')}
              className="rounded-2xl bg-slate-900 px-4 py-3.5 font-bold text-slate-100 ring-1 ring-white/10 transition active:scale-[0.98]"
            >
              Join with a camp code
            </button>
          </div>
        )}

        {mode === 'create' && (
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <label className="text-sm text-slate-400">
              Camp name
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Summer Camp 2026"
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none focus:border-amber-400"
              />
            </label>
            {session.error && <p className="text-sm text-red-400">{session.error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="rounded-2xl bg-gradient-to-br from-amber-300 to-amber-500 px-4 py-3.5 font-bold text-slate-900 shadow-lg shadow-amber-500/20 transition active:scale-[0.98] disabled:opacity-50"
            >
              {busy ? 'Creating…' : 'Create camp'}
            </button>
            <button type="button" onClick={() => setMode('choose')} className="text-sm text-slate-400">
              Back
            </button>
          </form>
        )}

        {mode === 'join' && (
          <form onSubmit={handleJoin} className="flex flex-col gap-3">
            <label className="text-sm text-slate-400">
              Camp code
              <input
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABCDE"
                maxLength={5}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-center text-2xl tracking-[0.3em] text-slate-100 outline-none focus:border-amber-400"
              />
            </label>
            {session.error && <p className="text-sm text-red-400">{session.error}</p>}
            <button
              type="submit"
              disabled={busy || code.trim().length === 0}
              className="rounded-2xl bg-gradient-to-br from-amber-300 to-amber-500 px-4 py-3.5 font-bold text-slate-900 shadow-lg shadow-amber-500/20 transition active:scale-[0.98] disabled:opacity-50"
            >
              {busy ? 'Joining…' : 'Join camp'}
            </button>
            <button type="button" onClick={() => setMode('choose')} className="text-sm text-slate-400">
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
