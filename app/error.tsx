'use client';
import { useEffect } from 'react';

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    console.error('[app error boundary]', error);
  }, [error]);

  function clearAndReload() {
    try {
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith('lexivo_')) toRemove.push(k);
      }
      toRemove.forEach(k => localStorage.removeItem(k));
    } catch { /* ignore if localStorage itself is broken */ }
    window.location.reload();
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center gap-6">
      <div className="text-6xl">⚠️</div>
      <div className="space-y-2 max-w-xs">
        <h1 className="text-xl font-bold text-[var(--text)]">Something went wrong</h1>
        <p className="text-sm text-[var(--text-muted)] leading-relaxed">
          The app encountered an unexpected error. Your account data is safe — this is usually caused by corrupt local storage.
        </p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={reset}
          className="btn-primary py-3 text-sm font-semibold"
        >
          Try again
        </button>
        <button
          onClick={clearAndReload}
          className="btn-secondary py-3 text-sm font-semibold"
        >
          Clear local data and reload
        </button>
      </div>
      {error.message && (
        <p className="text-[10px] text-[var(--text-muted)] font-mono max-w-xs break-all opacity-60">
          {error.message}
        </p>
      )}
    </div>
  );
}
