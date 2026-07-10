import { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

/**
 * Shows a small toast when a newer version of the app has been deployed and
 * the service worker has fetched it. Tapping "Refresh" activates the new
 * version and reloads — this is the fix for the "I deployed but still see the
 * old version" confusion, since updates now surface explicitly instead of
 * silently waiting for every tab to close.
 */
export function UpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [updateSW, setUpdateSW] = useState<((reload?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    const update = registerSW({
      onNeedRefresh() {
        setNeedRefresh(true);
      },
    });
    setUpdateSW(() => update);
  }, []);

  if (!needRefresh) return null;

  return (
    <div className="fixed inset-x-4 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[80] mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 shadow-xl ring-1 ring-line">
      <span className="text-sm font-semibold text-ink">A new version is available.</span>
      <button
        onClick={() => updateSW?.(true)}
        className="shrink-0 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-on-accent transition active:scale-95"
      >
        Refresh
      </button>
    </div>
  );
}
