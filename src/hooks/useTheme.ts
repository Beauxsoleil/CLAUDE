import { useEffect, useState } from 'react';

export type ThemeId = 'dark' | 'beige';

export const THEMES: { id: ThemeId; label: string; hint: string; swatch: string[] }[] = [
  { id: 'dark', label: 'Midnight', hint: 'Dark slate & amber', swatch: ['#0f172a', '#fbbf24', '#f1f5f9'] },
  { id: 'beige', label: 'Sandstone', hint: 'Minimalist warm beige', swatch: ['#ece5d8', '#c39457', '#2c2822'] },
];

const STORAGE_KEY = 'camp-points:theme';

function readInitial(): ThemeId {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'beige' || stored === 'dark' ? stored : 'dark';
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeId>(readInitial);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return { theme, setTheme };
}
