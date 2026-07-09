import { createContext, useCallback, useContext, useRef, useState } from 'react';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(() => Promise.resolve(true));

export function useConfirm() {
  return useContext(ConfirmContext);
}

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
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => settle(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl bg-surface p-5 pb-[max(2rem,env(safe-area-inset-bottom))] ring-1 ring-line"
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-surface3" />
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
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
