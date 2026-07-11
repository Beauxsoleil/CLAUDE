import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Shared bottom-sheet scaffold: dim backdrop + rounded panel with the grabber
 * bar. Adds the accessibility the ad-hoc sheets were missing — `role="dialog"`,
 * `aria-modal`, Escape-to-close, focus moved into the sheet on open and restored
 * on close, and a Tab focus trap.
 */
export function BottomSheet({
  onClose,
  label,
  children,
  className = '',
  overlayZ = 'z-50',
}: {
  onClose: () => void;
  label: string;
  children: React.ReactNode;
  className?: string;
  overlayZ?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusables = panel?.querySelectorAll<HTMLElement>(FOCUSABLE);
    (focusables && focusables.length ? focusables[0] : panel)?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === 'Tab' && panel) {
        const items = panel.querySelectorAll<HTMLElement>(FOCUSABLE);
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className={`fixed inset-0 ${overlayZ} flex items-end justify-center bg-black/60 backdrop-blur-sm`}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-t-3xl bg-surface p-5 pb-[max(2rem,env(safe-area-inset-bottom))] outline-none ring-1 ring-line ${className}`}
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-surface3" />
        {children}
      </div>
    </div>
  );
}
