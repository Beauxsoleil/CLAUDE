import { useCallback, useEffect, useState } from 'react';
import { campExists, createCamp } from '../lib/campRepo';
import type { Camp } from '../types';

const STORAGE_KEY = 'camp-points:campId';

export function useCampSession() {
  const [camp, setCamp] = useState<Camp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // A ?camp=CODE query param (e.g. from a shared QR link) auto-joins that
    // camp, unless this device is already in a camp (stored camp wins).
    const campParam = new URLSearchParams(location.search).get('camp');
    const storedId = localStorage.getItem(STORAGE_KEY);
    const target = storedId ?? campParam;

    const stripParam = () => {
      if (!campParam) return;
      const url = new URL(location.href);
      url.searchParams.delete('camp');
      history.replaceState({}, '', url.pathname + url.search + url.hash);
    };

    if (!target) {
      setLoading(false);
      stripParam();
      return;
    }
    campExists(target)
      .then((found) => {
        if (found) {
          setCamp(found);
          localStorage.setItem(STORAGE_KEY, found.id);
        } else if (storedId) {
          localStorage.removeItem(STORAGE_KEY);
        }
      })
      .catch(() => setError('Could not reach the server. Check your connection.'))
      .finally(() => {
        setLoading(false);
        stripParam();
      });
  }, []);

  const join = useCallback(async (code: string) => {
    setError(null);
    let found: Camp | null = null;
    try {
      found = await campExists(code);
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
      return false;
    }
    if (!found) {
      setError('No camp found with that code. Double-check it and try again.');
      return false;
    }
    localStorage.setItem(STORAGE_KEY, found.id);
    setCamp(found);
    return true;
  }, []);

  const create = useCallback(async (name: string) => {
    setError(null);
    try {
      const id = await createCamp(name.trim() || 'Camp');
      const newCamp: Camp = { id, name: name.trim() || 'Camp', createdAt: Date.now() };
      localStorage.setItem(STORAGE_KEY, id);
      setCamp(newCamp);
      return newCamp;
    } catch {
      setError('Could not create the camp. Check your connection and try again.');
      return null;
    }
  }, []);

  const leave = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setCamp(null);
  }, []);

  return { camp, loading, error, join, create, leave };
}
