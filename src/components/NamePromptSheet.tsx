import { useState } from 'react';
import { BottomSheet } from './BottomSheet';

export function NamePromptSheet({
  onSave,
  onClose,
}: {
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
  }

  return (
    <BottomSheet onClose={onClose} label="Who's scoring?" overlayZ="z-[70]">
      <form onSubmit={submit}>
        <h2 className="text-lg font-bold text-ink">Who's scoring?</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Your name is attached to points you award or deduct, so the History log shows who did what.
        </p>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          autoFocus
          maxLength={40}
          className="mt-4 w-full rounded-xl border border-line bg-surface2 px-4 py-3 text-lg text-ink outline-none focus:border-accent"
        />
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
            disabled={name.trim().length === 0}
            className="flex-1 rounded-2xl bg-accent px-4 py-3.5 font-bold text-on-accent transition active:scale-[0.98] disabled:opacity-40"
          >
            Continue
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
