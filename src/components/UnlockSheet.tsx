import { useState } from 'react';
import { BottomSheet } from './BottomSheet';

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
    <BottomSheet onClose={onClose} label="Enter scorekeeper PIN" overlayZ="z-[70]">
      <form onSubmit={submit}>
        <h2 className="text-lg font-bold text-ink">Enter scorekeeper PIN</h2>
        <p className="mt-1 text-sm text-ink-muted">Unlock to award and edit points on this device.</p>
        <input
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
    </BottomSheet>
  );
}
