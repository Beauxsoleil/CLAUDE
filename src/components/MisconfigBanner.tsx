import { useState } from 'react';
import { firebaseConfigured, usingEmulator } from '../lib/firebase';
import { XIcon } from './icons';

/**
 * Warns when the app is running without Firebase keys — in that state it talks
 * to a throwaway demo project and nothing saves, which otherwise looks fine.
 * Dismissible, and never shown when the emulator is in use.
 */
export function MisconfigBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (firebaseConfigured || usingEmulator || dismissed) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[90] flex items-center gap-3 bg-danger px-4 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] text-sm font-semibold text-white">
      <span className="flex-1">
        Not connected to Firebase — set your <code className="font-mono">VITE_FIREBASE_*</code> keys and
        rebuild, or nothing you enter will be saved.
      </span>
      <button onClick={() => setDismissed(true)} aria-label="Dismiss" className="shrink-0 p-1">
        <XIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
