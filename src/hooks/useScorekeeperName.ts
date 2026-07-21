import { useCallback, useEffect, useState } from 'react';

/**
 * Per-device, per-camp scorekeeper display name. Not a verified identity —
 * same honor-system trust model as the scorekeeper PIN (`useLock`) — just
 * enough to attribute "who awarded this" in the History log.
 */
export function useScorekeeperName(campId: string) {
  const key = `camp-points:scorekeeperName:${campId}`;
  const [name, setNameState] = useState<string>(() => localStorage.getItem(key) ?? '');

  useEffect(() => {
    setNameState(localStorage.getItem(`camp-points:scorekeeperName:${campId}`) ?? '');
  }, [campId]);

  const setName = useCallback(
    (next: string) => {
      const trimmed = next.trim();
      if (trimmed) localStorage.setItem(key, trimmed);
      else localStorage.removeItem(key);
      setNameState(trimmed);
    },
    [key],
  );

  return { name, setName };
}
