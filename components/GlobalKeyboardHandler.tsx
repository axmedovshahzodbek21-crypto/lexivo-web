'use client';
import { useEffect } from 'react';
import { useAppStore } from '@/lib/store';

export default function GlobalKeyboardHandler() {
  const { setShowShortcuts, setFocusMode, focusMode } = useAppStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        setShowShortcuts(true);
      }
      if (e.key === 'Escape') {
        setShowShortcuts(false);
        setFocusMode(false);
      }
      if (e.key === 'f' || e.key === 'F') {
        // Only toggle focus mode if not in an input
        setFocusMode(!focusMode);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [focusMode, setFocusMode, setShowShortcuts]);

  // Sync focus mode to body class
  useEffect(() => {
    if (focusMode) {
      document.body.classList.add('focus-mode');
    } else {
      document.body.classList.remove('focus-mode');
    }
  }, [focusMode]);

  return null;
}
