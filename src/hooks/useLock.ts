import { useCallback, useEffect, useState } from 'react';

/**
 * Per-device "viewer lock". A locked device can watch everything but its
 * mutating controls are hidden (see `canEdit`). If the camp has a scorekeeper
 * PIN, unlocking requires it; otherwise unlocking is free. This is a soft
 * guard against casual tampering by campers holding a viewing phone — not
 * hard security, since anyone with the camp code can still write via the API.
 */
export function useLock(campId: string, pin: string | undefined) {
  const key = `camp-points:locked:${campId}`;
  const [locked, setLocked] = useState<boolean>(() => localStorage.getItem(key) === '1');

  useEffect(() => {
    setLocked(localStorage.getItem(`camp-points:locked:${campId}`) === '1');
  }, [campId]);

  const lock = useCallback(() => {
    localStorage.setItem(key, '1');
    setLocked(true);
  }, [key]);

  const unlock = useCallback(
    (entered: string): boolean => {
      if (pin && entered !== pin) return false;
      localStorage.removeItem(key);
      setLocked(false);
      return true;
    },
    [key, pin],
  );

  return { locked, canEdit: !locked, hasPin: Boolean(pin), lock, unlock };
}
