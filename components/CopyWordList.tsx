'use client';
import { useState } from 'react';
import { useTranslation } from '@/lib/useTranslation';

// "Copy word list" — just the headwords, numbered, no translations. Shared
// by every unit and folder page (pre-built collections, My Words, Library).
// Same format as the app's lib/widgets/copy_word_list.dart.

export function formatWordList(words: string[]): string {
  return words.map((w, i) => `${i + 1}. ${w}`).join('\n');
}

// Folder copy: each unit under its own name, numbering restarting per unit.
export function formatFolderWordList(units: { name: string; words: string[] }[]): string {
  return units
    .filter(u => u.words.length > 0)
    .map(u => `${u.name}\n${formatWordList(u.words)}`)
    .join('\n\n');
}

function useCopyToast() {
  const [shown, setShown] = useState(false);
  async function copy(text: string | Promise<string>) {
    if (typeof text === 'string') {
      if (!text) return;
      await navigator.clipboard.writeText(text);
    } else if (typeof ClipboardItem !== 'undefined') {
      // Text still being fetched: hand the clipboard a promise inside the
      // click — Safari rejects a writeText() that only runs after an await.
      await navigator.clipboard.write([new ClipboardItem({
        'text/plain': text.then(s => new Blob([s], { type: 'text/plain' })),
      })]);
    } else {
      await navigator.clipboard.writeText(await text);
    }
    setShown(true);
    setTimeout(() => setShown(false), 1500);
  }
  return { shown, copy };
}

function CopiedToast() {
  const t = useTranslation();
  return (
    <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-xl text-sm font-semibold shadow-xl bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] animate-fade-in">
      {t.common.copiedToast}
    </div>
  );
}

const ICON_CLASS = 'btn-icon text-base text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors disabled:opacity-40';

// Header button for a single unit page.
export function CopyWordListButton({ words, className }: { words: string[]; className?: string }) {
  const t = useTranslation();
  const { shown, copy } = useCopyToast();
  return (
    <>
      <button
        onClick={() => copy(formatWordList(words)).catch(() => {})}
        disabled={words.length === 0}
        className={className ?? ICON_CLASS}
        aria-label={t.common.copyWordList}
        title={t.common.copyWordList}
      >📋</button>
      {shown && <CopiedToast />}
    </>
  );
}

// Header button for a folder page: opens a sheet to copy every unit at once
// (grouped by unit) or any single unit. loadWords returns each unit's words
// in the same order as units; it's only called on a click, so folders whose
// words aren't already in memory (Library) fetch them lazily.
export function CopyFolderWordListButton({ units, loadWords, className }: {
  units: { name: string; count: number }[];
  loadWords: () => Promise<string[][]> | string[][];
  className?: string;
}) {
  const t = useTranslation();
  const { shown, copy } = useCopyToast();
  const [open, setOpen] = useState(false);
  const total = units.reduce((s, u) => s + u.count, 0);

  function pick(unitIndex: number | null) {
    setOpen(false);
    const format = (words: string[][]) => unitIndex === null
      ? formatFolderWordList(units.map((u, i) => ({ name: u.name, words: words[i] ?? [] })))
      : formatWordList(words[unitIndex] ?? []);
    const loaded = loadWords();
    copy(Array.isArray(loaded) ? format(loaded) : loaded.then(format)).catch(() => {});
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={total === 0}
        className={className ?? ICON_CLASS}
        aria-label={t.common.copyWordList}
        title={t.common.copyWordList}
      >📋</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 pb-4 sm:pb-0" onClick={() => setOpen(false)}>
          <div className="bg-[var(--surface)] rounded-2xl w-full max-w-sm max-h-[75vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h2 className="text-base font-bold text-[var(--text)]">{t.common.copyWordList}</h2>
              <button onClick={() => setOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text)] text-lg">✕</button>
            </div>
            <button
              onClick={() => pick(null)}
              className="flex items-center gap-3 px-5 py-3 text-left hover:bg-[var(--surface-2)] transition-colors border-b border-[var(--border)]"
            >
              <span>📋</span>
              <span className="flex-1 font-bold text-sm text-[var(--text)]">{t.common.copyAllUnits}</span>
              <span className="text-xs text-[var(--text-muted)]">{t.libraryPage.wordsCount(total)}</span>
            </button>
            <div className="overflow-y-auto pb-2">
              {units.map((u, i) => (
                <button
                  key={`${i}-${u.name}`}
                  onClick={() => pick(i)}
                  disabled={u.count === 0}
                  className="w-full flex items-center gap-3 px-5 py-2.5 text-left hover:bg-[var(--surface-2)] transition-colors disabled:opacity-40"
                >
                  <span className="flex-1 text-sm text-[var(--text)] truncate">{u.name}</span>
                  <span className="text-xs text-[var(--text-muted)] shrink-0">{t.libraryPage.wordsCount(u.count)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {shown && <CopiedToast />}
    </>
  );
}
