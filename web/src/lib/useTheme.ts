import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

export const THEME_KEY = 'splitr-theme';

/**
 * The initial class is stamped by a blocking script in index.html - reading it
 * back here rather than recomputing avoids a first render that disagrees with
 * what is already painted. An explicit choice is remembered and, from then on,
 * wins over the system preference.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Private mode or blocked storage: the toggle still works for this visit.
    }
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);

  return { theme, toggle };
}
