import { useCallback, useEffect, useState } from 'react';
import { campExists, createCamp } from '../lib/campRepo';
import type { Camp } from '../types';

const STORAGE_KEY = 'camp-points:campId';

export function useCampSession() {
  const [camp, setCamp] = useState<Camp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedId = localStorage.getItem(STORAGE_KEY);
    if (!storedId) {
      setLoading(false);
      return;
    }
    campExists(storedId)
      .then((found) => {
        if (found) setCamp(found);
        else localStorage.removeItem(STORAGE_KEY);
      })
      .catch(() => setError('Could not reach the server. Check your connection.'))
      .finally(() => setLoading(false));
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
