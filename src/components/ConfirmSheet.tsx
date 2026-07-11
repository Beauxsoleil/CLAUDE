import { useCallback, useRef, useState } from 'react';
import { ConfirmContext, type ConfirmFn, type ConfirmOptions } from './confirmContext';
import { BottomSheet } from './BottomSheet';

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((o) => {
    setOpts(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  function settle(value: boolean) {
    resolver.current?.(value);
    resolver.current = null;
    setOpts(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && (
        <BottomSheet onClose={() => settle(false)} label={opts.title} overlayZ="z-[70]">
          <h2 className="text-lg font-bold text-ink">{opts.title}</h2>
          {opts.message && <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{opts.message}</p>}
          <div className="mt-5 flex gap-3">
            <button
              onClick={() => settle(false)}
              className="flex-1 rounded-2xl bg-surface2 px-4 py-3.5 font-bold text-ink-muted transition active:scale-[0.98]"
            >
              Cancel
            </button>
            <button
              onClick={() => settle(true)}
              className={`flex-1 rounded-2xl px-4 py-3.5 font-bold transition active:scale-[0.98] ${
                opts.danger ? 'bg-danger text-white' : 'bg-accent text-on-accent'
              }`}
            >
              {opts.confirmLabel ?? 'Confirm'}
            </button>
          </div>
        </BottomSheet>
      )}
    </ConfirmContext.Provider>
  );
}
