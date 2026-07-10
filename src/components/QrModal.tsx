import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/**
 * Shows a QR code encoding a join link (…/?camp=CODE). Another counselor's
 * phone camera opens the link and auto-joins the camp — no typing the code,
 * no in-app scanner needed.
 */
export function QrModal({ campId, onClose }: { campId: string; onClose: () => void }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const joinUrl = `${location.origin}/?camp=${campId}`;

  useEffect(() => {
    QRCode.toDataURL(joinUrl, { width: 512, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } })
      .then(setDataUrl)
      .catch(() => setDataUrl(null));
  }, [joinUrl]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl bg-surface p-5 pb-[max(2rem,env(safe-area-inset-bottom))] ring-1 ring-line"
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-surface3" />
        <h2 className="text-center text-lg font-bold text-ink">Scan to join</h2>
        <p className="mt-1 text-center text-sm text-ink-muted">
          Point another phone's camera at this code to join{' '}
          <span className="font-bold tracking-widest text-accent-text">{campId}</span>.
        </p>
        <div className="mx-auto mt-4 w-56 rounded-2xl bg-white p-3">
          {dataUrl ? (
            <img src={dataUrl} alt={`QR code to join camp ${campId}`} className="w-full" />
          ) : (
            <div className="flex aspect-square items-center justify-center text-sm text-slate-500">
              Generating…
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="mt-5 w-full rounded-2xl bg-surface2 px-4 py-3.5 font-bold text-ink-muted transition active:scale-[0.98]"
        >
          Done
        </button>
      </div>
    </div>
  );
}
