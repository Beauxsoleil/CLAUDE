import { useState } from 'react';

export function UnlockSheet({
  onUnlock,
  onClose,
}: {
  onUnlock: (pin: string) => boolean;
  onClose: () => void;
}) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (onUnlock(pin)) {
      onClose();
    } else {
      setError(true);
      setPin('');
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-md rounded-t-3xl bg-surface p-5 pb-[max(2rem,env(safe-area-inset-bottom))] ring-1 ring-line"
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-surface3" />
        <h2 className="text-lg font-bold text-ink">Enter scorekeeper PIN</h2>
        <p className="mt-1 text-sm text-ink-muted">Unlock to award and edit points on this device.</p>
        <input
          autoFocus
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={(e) => {
            setPin(e.target.value.replace(/\D/g, ''));
            setError(false);
          }}
          placeholder="••••"
          className="mt-4 w-full rounded-xl border border-line bg-surface2 px-4 py-3 text-center text-2xl tracking-[0.5em] text-ink outline-none focus:border-accent"
        />
        {error && <p className="mt-2 text-sm text-danger">That PIN didn't match. Try again.</p>}
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-2xl bg-surface2 px-4 py-3.5 font-bold text-ink-muted transition active:scale-[0.98]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pin.length === 0}
            className="flex-1 rounded-2xl bg-accent px-4 py-3.5 font-bold text-on-accent transition active:scale-[0.98] disabled:opacity-40"
          >
            Unlock
          </button>
        </div>
      </form>
    </div>
  );
}
