'use client';
import { usePathname } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { useTranslation } from '@/lib/useTranslation';

type Translations = ReturnType<typeof useTranslation>;

function getPageShortcuts(t: Translations): Record<string, { label: string; rows: { keys: string[]; action: string }[] }> {
  return {
    '/learn': {
      label: t.nav.learn,
      rows: [
        { keys: ['Space', 'Enter'], action: t.keyboardHelp.actionRevealGotIt },
        { keys: ['H'], action: t.keyboardHelp.actionHintTooHard },
        { keys: ['S'], action: t.keyboardHelp.actionSpeakWord },
        { keys: ['★ / U'], action: t.keyboardHelp.actionStarUnstar },
        { keys: ['F'], action: t.keyboardHelp.actionToggleFocus },
      ],
    },
    '/srs': {
      label: t.keyboardHelp.srsReview,
      rows: [
        { keys: ['Space', 'Enter'], action: t.keyboardHelp.actionRevealAnswer },
        { keys: ['→', 'K'], action: t.keyboardHelp.actionKnowIt },
        { keys: ['←', 'J'], action: t.keyboardHelp.actionNotYet },
        { keys: ['S'], action: t.keyboardHelp.actionSpeakWord },
      ],
    },
    '/flashcards': {
      label: t.nav.flashcards,
      rows: [
        { keys: ['Space', 'Enter'], action: t.keyboardHelp.actionFlipCard },
        { keys: ['→', 'K'], action: t.keyboardHelp.actionEasy },
        { keys: ['←', 'J'], action: t.keyboardHelp.actionHard },
        { keys: ['S'], action: t.keyboardHelp.actionSpeakWord },
        { keys: ['F'], action: t.keyboardHelp.actionToggleFocus },
      ],
    },
    '/quiz': {
      label: t.nav.quiz,
      rows: [
        { keys: ['1', '2', '3', '4'], action: t.keyboardHelp.actionSelectOption },
        { keys: ['→', 'Enter'], action: t.keyboardHelp.actionNextQuestion },
        { keys: ['S'], action: t.keyboardHelp.actionSpeakWord },
      ],
    },

  };
}

function getGlobalRows(t: Translations) {
  return [
    { keys: ['?'], action: t.keyboardHelp.actionShowHideShortcuts },
    { keys: ['Esc'], action: t.keyboardHelp.actionClosePanelBack },
  ];
}

export default function KeyboardHelp() {
  const { showShortcuts, setShowShortcuts } = useAppStore();
  const pathname = usePathname();
  const t = useTranslation();

  if (!showShortcuts) return null;

  const pageShortcuts = getPageShortcuts(t);
  const globalRows = getGlobalRows(t);

  // Match the most specific page prefix
  const pageKey = Object.keys(pageShortcuts).find(k => pathname.startsWith(k));
  const page = pageKey ? pageShortcuts[pageKey] : null;

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50"
      onClick={() => setShowShortcuts(false)}
    >
      <div
        className="bg-[var(--card,var(--surface))] rounded-2xl p-6 w-full max-w-sm mx-4 animate-pop border border-[var(--border)]"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="font-bold text-lg mb-4 text-[var(--text)]">{t.keyboardHelp.title}</h2>

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
          {t.keyboardHelp.global}
        </p>
        <div className="space-y-2">
          {globalRows.map(({ keys, action }) => (
            <ShortcutRow key={action} keys={keys} action={action} />
          ))}
        </div>

        <button
          onClick={() => setShowShortcuts(false)}
          className="mt-5 w-full btn-secondary text-sm"
        >
          {t.keyboardHelp.close} <kbd className="ml-1">Esc</kbd>
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
