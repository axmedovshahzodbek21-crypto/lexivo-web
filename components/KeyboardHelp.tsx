'use client';
import { usePathname } from 'next/navigation';
import { useAppStore } from '@/lib/store';

const PAGE_SHORTCUTS: Record<string, { label: string; rows: { keys: string[]; action: string }[] }> = {
  '/learn': {
    label: 'Learn',
    rows: [
      { keys: ['Space', 'Enter'], action: 'Reveal card, then Got it' },
      { keys: ['H'], action: 'Hint (before) · Too hard (after)' },
      { keys: ['S'], action: 'Speak word' },
      { keys: ['★ / U'], action: 'Star / unstar word' },
      { keys: ['F'], action: 'Toggle focus mode' },
    ],
  },
  '/srs': {
    label: 'SRS Review',
    rows: [
      { keys: ['Space', 'Enter'], action: 'Reveal answer' },
      { keys: ['→', 'K'], action: 'Knew it' },
      { keys: ['←', 'J'], action: 'Forgot' },
      { keys: ['S'], action: 'Speak word' },
    ],
  },
  '/flashcards': {
    label: 'Flashcards',
    rows: [
      { keys: ['Space', 'Enter'], action: 'Flip card' },
      { keys: ['→', 'K'], action: 'Know it' },
      { keys: ['←', 'J'], action: 'Again' },
      { keys: ['S'], action: 'Speak word' },
      { keys: ['F'], action: 'Toggle focus mode' },
    ],
  },
  '/quiz': {
    label: 'Quiz',
    rows: [
      { keys: ['1', '2', '3', '4'], action: 'Select option' },
      { keys: ['→', 'Enter'], action: 'Next question' },
      { keys: ['S'], action: 'Speak word' },
    ],
  },
  '/pronunciation': {
    label: 'Pronunciation',
    rows: [
      { keys: ['R'], action: 'Start / stop recording' },
      { keys: ['S'], action: 'Play target audio' },
    ],
  },
};

const GLOBAL_ROWS = [
  { keys: ['?'], action: 'Show / hide shortcuts' },
  { keys: ['Esc'], action: 'Close panel / back' },
];

export default function KeyboardHelp() {
  const { showShortcuts, setShowShortcuts } = useAppStore();
  const pathname = usePathname();

  if (!showShortcuts) return null;

  // Match the most specific page prefix
  const pageKey = Object.keys(PAGE_SHORTCUTS).find(k => pathname.startsWith(k));
  const page = pageKey ? PAGE_SHORTCUTS[pageKey] : null;

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50"
      onClick={() => setShowShortcuts(false)}
    >
      <div
        className="bg-[var(--card,var(--surface))] rounded-2xl p-6 w-full max-w-sm mx-4 animate-pop border border-[var(--border)]"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="font-bold text-lg mb-4 text-[var(--text)]">⌨️ Keyboard Shortcuts</h2>

        {page && (
          <>
            <p className="text-xs font-semibold text-[var(--primary)] uppercase tracking-wide mb-2">
              {page.label}
            </p>
            <div className="space-y-2 mb-4">
              {page.rows.map(({ keys, action }) => (
                <ShortcutRow key={action} keys={keys} action={action} />
              ))}
            </div>
          </>
        )}

        <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">
          Global
        </p>
        <div className="space-y-2">
          {GLOBAL_ROWS.map(({ keys, action }) => (
            <ShortcutRow key={action} keys={keys} action={action} />
          ))}
        </div>

        <button
          onClick={() => setShowShortcuts(false)}
          className="mt-5 w-full btn-secondary text-sm"
        >
          Close <kbd className="ml-1">Esc</kbd>
        </button>
      </div>
    </div>
  );
}

function ShortcutRow({ keys, action }: { keys: string[]; action: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-[var(--text-muted)]">{action}</span>
      <div className="flex gap-1 shrink-0">
        {keys.map(k => <kbd key={k}>{k}</kbd>)}
      </div>
    </div>
  );
}
