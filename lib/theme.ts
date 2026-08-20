const KEY = 'lexivo_theme';

export type Theme = 'light' | 'dark' | 'system';

const VALID_THEMES: Theme[] = ['light', 'dark', 'system'];

export function getTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem(KEY);
  return VALID_THEMES.includes(stored as Theme) ? (stored as Theme) : 'system';
}

function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme !== 'system') return theme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function setTheme(theme: Theme) {
  localStorage.setItem(KEY, theme);
  document.documentElement.setAttribute('data-theme', resolveTheme(theme));
}

export function toggleTheme(): Theme {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

export function applyStoredTheme() {
  const theme = getTheme();
  document.documentElement.setAttribute('data-theme', resolveTheme(theme));
}

// Keeps the applied theme in sync with OS-level changes while `theme` is
// 'system'. Returns an unsubscribe function — call it on unmount, otherwise
// every remount (e.g. React Strict Mode's double-invoke) leaks one more
// listener that never gets cleaned up.
export function watchSystemTheme(): () => void {
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => {
    if (getTheme() === 'system') applyStoredTheme();
  };
  mql.addEventListener('change', handler);
  return () => mql.removeEventListener('change', handler);
}
