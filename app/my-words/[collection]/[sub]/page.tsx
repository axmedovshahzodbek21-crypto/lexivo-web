'use client';
import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/useTranslation';
import { getImportedWordsByCollection, deleteImportedWord, deleteImportedCollection, getMyUnitProgress, getMyUnitPendingNewWords } from '@/lib/storage';
import { pushLists } from '@/lib/sync';
import { speakText } from '@/lib/speech';
import type { ImportedWord } from '@/lib/types';

interface Props {
  params: Promise<{ collection: string; sub: string }>;
}

// Words page for a collection inside a folder: /my-words/[folder]/[collection]
export default function FolderCollectionPage({ params }: Props) {
  const { collection: encodedFolder, sub: encodedSub } = use(params);
  const folder = decodeURIComponent(encodedFolder);
  const collectionName = decodeURIComponent(encodedSub);
  const router = useRouter();
  const t = useTranslation();
  const [words, setWords] = useState<ImportedWord[]>([]);
  const [completedAt, setCompletedAt] = useState<string | undefined>(undefined);
  const [pendingNewWords, setPendingNewWords] = useState<string[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmModal, setConfirmModal] = useState<
    | { type: 'word'; word: string; message: string }
    | { type: 'collection'; message: string }
    | { type: 'bulk'; count: number; message: string }
    | null
  >(null);

  const loadProgress = (currentWords: ImportedWord[]) => {
    const p = getMyUnitProgress(folder, collectionName);
    setCompletedAt(p.completedAt);
    setPendingNewWords(getMyUnitPendingNewWords(folder, collectionName, currentWords.map(w => w.word)));
  };

  useEffect(() => {
    const load = () => {
      const w = getImportedWordsByCollection(collectionName, folder);
      setWords(w);
      loadProgress(w);
    };
    load();
  }, [folder, collectionName]);

  function toggleSelectMode() {
    setSelectMode(v => !v);
    setSelected(new Set());
  }

  function toggleSelected(word: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(word)) next.delete(word); else next.add(word);
      return next;
    });
  }

  function requestDelete(word: string) {
    setConfirmModal({ type: 'word', word, message: t.myWords.deleteConfirm });
  }

  function requestDeleteCollection() {
    setConfirmModal({ type: 'collection', message: `Delete the "${collectionName}" collection and all its words?` });
  }

  function requestDeleteSelected() {
    if (selected.size === 0) return;
    setConfirmModal({ type: 'bulk', count: selected.size, message: `Delete ${selected.size} selected word${selected.size !== 1 ? 's' : ''}?` });
  }

  function confirmDelete() {
    if (!confirmModal) return;
    if (confirmModal.type === 'word') {
      deleteImportedWord(confirmModal.word, collectionName, folder);
      pushLists();
      const w = getImportedWordsByCollection(collectionName, folder);
      setWords(w);
      loadProgress(w);
    } else if (confirmModal.type === 'collection') {
      deleteImportedCollection(collectionName, folder);
      pushLists();
      setConfirmModal(null);
      router.push(`/my-words/${encodeURIComponent(folder)}`);
      return;
    } else if (confirmModal.type === 'bulk') {
      selected.forEach(word => deleteImportedWord(word, collectionName, folder));
      pushLists();
      const w = getImportedWordsByCollection(collectionName, folder);
      setWords(w);
      loadProgress(w);
      setSelected(new Set());
      setSelectMode(false);
    }
    setConfirmModal(null);
  }

  const studyParam = `source=my-words&myCollection=${encodeURIComponent(collectionName)}&myFolder=${encodeURIComponent(folder)}`;

  return (
    <div className="flex flex-col min-h-screen animate-fade-in pb-24">
      <div className="flex items-center gap-3 p-4 border-b border-[var(--border)]">
        <button onClick={() => router.back()} className="btn-icon text-lg" aria-label="Go back">←</button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-[var(--text)] truncate">{collectionName}</h1>
          <p className="text-xs text-[var(--text-muted)] truncate">
            <span className="text-[var(--primary)]">📁 {folder}</span> · {t.myWords.wordCount(words.length)}
          </p>
          {completedAt && (
            <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--success)' }}>
              {t.myWords.completedBadge}
              {pendingNewWords.length > 0 && (
                <span className="text-[var(--text-muted)] font-normal"> · {t.myWords.newWordsToLearn(pendingNewWords.length)}</span>
              )}
            </p>
          )}
        </div>
        {words.length > 0 && (
          <button
            onClick={toggleSelectMode}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${selectMode ? 'bg-[var(--primary)] text-white' : 'bg-[var(--surface-2)] text-[var(--text-muted)]'}`}
          >
            {selectMode ? 'Cancel' : 'Select'}
          </button>
        )}
        <button
          onClick={requestDeleteCollection}
          className="btn-icon text-base text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
          aria-label="Delete collection"
        >🗑️</button>
        <Link
          href={`/import?folder=${encodeURIComponent(folder)}&collection=${encodeURIComponent(collectionName)}`}
          className="w-9 h-9 rounded-full bg-[var(--primary-bg)] flex items-center justify-center text-lg font-bold text-[var(--primary)]"
          aria-label={t.myWords.addWords}
        >+</Link>
      </div>

      <div className="p-4 space-y-4">
        {words.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="text-6xl">✍️</div>
            <p className="text-[var(--text-muted)] text-sm">{t.myWords.empty}</p>
            <Link
              href={`/import?folder=${encodeURIComponent(folder)}&collection=${encodeURIComponent(collectionName)}`}
              className="btn-primary px-6 py-3 text-sm font-semibold"
            >
              {t.myWords.addWords}
            </Link>
          </div>
        ) : (
          <>
            {pendingNewWords.length > 0 && (() => {
              const newParam = `${studyParam}&onlyNew=1`;
              return (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold" style={{ color: 'var(--success)' }}>
                    {t.myWords.studyNewWords(pendingNewWords.length)}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Link href={`/learn?${newParam}`} className="flex flex-col items-center gap-1.5 py-3 rounded-2xl text-center transition-colors" style={{ background: 'rgba(34,197,94,0.12)', border: '1.5px solid var(--success)' }}>
                      <span className="text-2xl">📖</span>
                      <span className="text-xs font-semibold" style={{ color: 'var(--success)' }}>Learn</span>
                    </Link>
                    <Link href={`/flashcards?${newParam}`} className="flex flex-col items-center gap-1.5 py-3 rounded-2xl text-center transition-colors" style={{ background: 'rgba(34,197,94,0.12)', border: '1.5px solid var(--success)' }}>
                      <span className="text-2xl">🃏</span>
                      <span className="text-xs font-semibold" style={{ color: 'var(--success)' }}>Flashcards</span>
                    </Link>
                    <Link href={`/quiz?${newParam}`} className="flex flex-col items-center gap-1.5 py-3 rounded-2xl text-center transition-colors" style={{ background: 'rgba(34,197,94,0.12)', border: '1.5px solid var(--success)' }}>
                      <span className="text-2xl">❓</span>
                      <span className="text-xs font-semibold" style={{ color: 'var(--success)' }}>Quiz</span>
                    </Link>
                    <Link href={`/matching?${newParam}`} className="flex flex-col items-center gap-1.5 py-3 rounded-2xl text-center transition-colors" style={{ background: 'rgba(34,197,94,0.12)', border: '1.5px solid var(--success)' }}>
                      <span className="text-2xl">🔗</span>
                      <span className="text-xs font-semibold" style={{ color: 'var(--success)' }}>Match</span>
                    </Link>
                  </div>
                </div>
              );
            })()}
            {pendingNewWords.length > 0 && (
              <p className="text-xs font-semibold text-[var(--text-muted)]">{t.myWords.studyAllWords}</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Link href={`/learn?${studyParam}`} className="flex flex-col items-center gap-1.5 py-3 rounded-2xl text-center transition-colors" style={{ background: 'rgba(108,99,255,0.1)', border: '1.5px solid rgba(108,99,255,0.3)' }}>
                <span className="text-2xl">📖</span>
                <span className="text-xs font-semibold" style={{ color: 'var(--primary)' }}>Learn</span>
              </Link>
              <Link href={`/flashcards?${studyParam}`} className="flex flex-col items-center gap-1.5 py-3 rounded-2xl text-center transition-colors" style={{ background: 'rgba(255,107,53,0.1)', border: '1.5px solid rgba(255,107,53,0.3)' }}>
                <span className="text-2xl">🃏</span>
                <span className="text-xs font-semibold" style={{ color: '#FF6B35' }}>Flashcards</span>
              </Link>
              <Link href={`/quiz?${studyParam}`} className="flex flex-col items-center gap-1.5 py-3 rounded-2xl text-center transition-colors" style={{ background: 'rgba(245,158,11,0.1)', border: '1.5px solid rgba(245,158,11,0.3)' }}>
                <span className="text-2xl">❓</span>
                <span className="text-xs font-semibold" style={{ color: 'var(--warning)' }}>Quiz</span>
              </Link>
              <Link href={`/matching?${studyParam}`} className="flex flex-col items-center gap-1.5 py-3 rounded-2xl text-center transition-colors" style={{ background: 'rgba(16,185,129,0.1)', border: '1.5px solid rgba(16,185,129,0.3)' }}>
                <span className="text-2xl">🔗</span>
                <span className="text-xs font-semibold" style={{ color: 'var(--success)' }}>Match</span>
              </Link>
            </div>

            <div className="space-y-2">
              {words.map((w, i) => {
                const isSelected = selected.has(w.word);
                return (
                  <div
                    key={i}
                    className={`card space-y-2 transition-colors ${selectMode ? 'cursor-pointer' : ''} ${isSelected ? 'ring-2 ring-[var(--primary)]' : ''}`}
                    onClick={selectMode ? () => toggleSelected(w.word) : undefined}
                  >
                    <div className="flex items-start justify-between gap-2">
                      {selectMode && (
                        <div
                          className={`w-5 h-5 rounded-md border-2 shrink-0 mt-0.5 flex items-center justify-center ${isSelected ? 'bg-[var(--primary)] border-[var(--primary)]' : 'border-[var(--border)]'}`}
                        >
                          {isSelected && <span className="text-white text-xs leading-none">✓</span>}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[var(--text)]">{w.word}</span>
                          {!selectMode && (
                            <button onClick={e => { e.stopPropagation(); speakText(w.word, w.language); }} className="w-6 h-6 rounded-full bg-[var(--primary-bg)] flex items-center justify-center text-xs hover:bg-[var(--primary)] hover:text-white transition-colors shrink-0" aria-label="Listen">🔊</button>
                          )}
                        </div>
                        <p className="text-sm font-medium text-[var(--primary)] mt-0.5">{w.translation}</p>
                        {w.definition && <p className="text-xs text-[var(--text-muted)] mt-1">{w.definition}</p>}
                        {w.examples.map((ex, exIdx) => (
                          <div key={exIdx}>
                            <p className="text-xs italic text-[var(--text)] mt-0.5">&quot;{ex.sentence}&quot;</p>
                            {ex.translation && <p className="text-xs text-[var(--text-muted)] pl-2">↳ {ex.translation}</p>}
                          </div>
                        ))}
                      </div>
                      {!selectMode && (
                        <button onClick={() => requestDelete(w.word)} className="text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors text-sm shrink-0 mt-0.5" aria-label="Delete word">🗑️</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {!selectMode && (
            <Link
              href={`/import?folder=${encodeURIComponent(folder)}&collection=${encodeURIComponent(collectionName)}`}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl border-2 border-dashed border-[var(--border)] text-sm font-medium text-[var(--text-muted)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
            >
              <span>+</span>
              <span>{t.myWords.addWords}</span>
            </Link>
            )}
          </>
        )}
      </div>

      {selectMode && selected.size > 0 && (
        <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl bg-[var(--surface)] border border-[var(--border)]">
          <span className="text-sm font-semibold text-[var(--text)]">{selected.size} selected</span>
          <button
            onClick={requestDeleteSelected}
            className="px-4 py-2 rounded-xl text-sm font-bold text-white"
            style={{ background: 'var(--danger)' }}
          >
            🗑️ Delete
          </button>
        </div>
      )}

      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 pb-4 sm:pb-0" onClick={() => setConfirmModal(null)}>
          <div className="bg-[var(--surface)] rounded-2xl w-full max-w-sm p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <p className="text-[var(--text)] font-semibold mb-6">{confirmModal.message}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[var(--text-muted)] bg-[var(--surface-2)]"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: 'var(--danger)' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
