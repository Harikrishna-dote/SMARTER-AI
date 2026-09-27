import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { toggleCommand } from '../../store/uiSlice';
import type { ThemeMode } from '../../lib/types';

function resolve(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}

export function ThemeManager() {
  const dispatch = useAppDispatch();
  const theme = useAppSelector((s) => s.ui.theme);

  useEffect(() => {
    const apply = () => {
      const resolved = resolve(theme);
      const root = document.documentElement;
      root.classList.toggle('dark', resolved === 'dark');
      root.style.colorScheme = resolved;
      localStorage.setItem('smarterai.theme', theme);
    };
    apply();

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => apply();
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [theme]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        dispatch(toggleCommand());
      }
    };
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch]);

  return null;
}
