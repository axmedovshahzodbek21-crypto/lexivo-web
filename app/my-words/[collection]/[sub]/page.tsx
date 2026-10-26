'use client';
import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/useTranslation';
import { getImportedWordsByCollection, deleteImportedWord, deleteImportedWords, deleteImportedCollection, getMyUnitProgress, getMyUnitPendingNewWords, getMyActivityPendingNewWords, addImportedWords, generateImportedWordId } from '@/lib/storage';
import { pushLists, pullAll } from '@/lib/sync';
import { speakText } from '@/lib/speech';
import type { ImportedWord } from '@/lib/types';
import type { AiParsedWord } from '@/lib/ai-import';
import AiAddWordsPanel, { UnitTabBar, type UnitTab } from '@/components/AiAddWordsPanel';
import { CopyWordListButton } from '@/components/CopyWordList';

const PREVIEW_EXAMPLES = 3;

function toggleIn(setter: (fn: (prev: Set<string>) => Set<string>) => void, id: string) {
  setter(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
}

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
  const [tab, setTab] = useState<UnitTab>('words');
  const [completedAt, setCompletedAt] = useState<string | undefined>(undefined);
  const [progress, setProgress] = useState<{ learnDone: boolean; flashcardDone: boolean; quizDone: boolean; matchDone: boolean }>({ learnDone: false, flashcardDone: false, quizDone: false, matchDone: false });
  const [pendingNewWords, setPendingNewWords] = useState<string[]>([]);
  const [pendingByActivity, setPendingByActivity] = useState({ learn: 0, flashcard: 0, quiz: 0, match: 0 });
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Word rows are compact; tapping one expands its definition + examples
  // (a word with 10 examples used to fill the whole screen on its own).
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [allExamples, setAllExamples] = useState<Set<string>>(new Set());
  const [confirmModal, setConfirmModal] = useState<
    | { type: 'word'; id: string; message: string }
    | { type: 'collection'; message: string }
    | { type: 'bulk'; count: number; message: string }
    | null
  >(null);

  const loadProgress = (currentWords: ImportedWord[]) => {
    const p = getMyUnitProgress(folder, collectionName);
    const wordList = currentWords.map(w => w.word);
    setCompletedAt(p.completedAt);
    setProgress({ learnDone: p.learnDone, flashcardDone: p.flashcardDone, quizDone: p.quizDone, matchDone: p.matchDone });
    setPendingNewWords(getMyUnitPendingNewWords(folder, collectionName, wordList));
    setPendingByActivity({
      learn: getMyActivityPendingNewWords(folder, collectionName, 'learn', wordList).length,
      flashcard: getMyActivityPendingNewWords(folder, collectionName, 'flashcard', wordList).length,
      quiz: getMyActivityPendingNewWords(folder, collectionName, 'quiz', wordList).length,
      match: getMyActivityPendingNewWords(folder, collectionName, 'match', wordList).length,
    });
  };

  useEffect(() => {
    const load = () => {
      const w = getImportedWordsByCollection(collectionName, folder);
      setWords(w);
      loadProgress(w);
    };
    load();
    pullAll().then(load);
    // Re-check progress when the user returns from a Learn/Flashcards/Quiz/Match
    // session (e.g. via the back button), so the just-finished activity's
    // checkmark shows up without requiring a manual refresh.
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [folder, collectionName]);

  function toggleSelectMode() {
    setSelectMode(v => !v);
    setSelected(new Set());
  }

  function toggleSelected(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function requestDelete(id: string) {
    setConfirmModal({ type: 'word', id, message: t.myWords.deleteConfirm });
  }

  function requestDeleteCollection() {
    setConfirmModal({ type: 'collection', message: t.myWords.deleteCollectionConfirm(collectionName) });
  }

  function requestDeleteSelected() {
    if (selected.size === 0) return;
    setConfirmModal({ type: 'bulk', count: selected.size, message: t.myWords.deleteSelectedConfirm(selected.size) });
  }

  function confirmDelete() {
    if (!confirmModal) return;
    if (confirmModal.type === 'word') {
      deleteImportedWord(confirmModal.id, collectionName, folder);
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
      deleteImportedWords(selected, collectionName, folder);
      pushLists();
      const w = getImportedWordsByCollection(collectionName, folder);
      setWords(w);
      loadProgress(w);
      setSelected(new Set());
      setSelectMode(false);
    }
    setConfirmModal(null);
  }

  // onAdd for the shared AiAddWordsPanel (same panel Library units use).
  async function addWords(parsed: AiParsedWord[], langCode: string) {
    const rows: ImportedWord[] = parsed.map(w => ({
      id: generateImportedWordId(),
      word: w.word,
      partOfSpeech: w.partOfSpeech,
      pronunciation: w.pronunciation,
      translation: w.translation,
      definition: w.definition,
      definitionUz: w.definitionUz,
      examples: w.examples.map(e => ({ sentence: e.sentence, translation: e.translation || undefined })),
      language: langCode,
      addedAt: Date.now(),
      collectionName,
    }));
    addImportedWords(rows, collectionName, folder);
    pushLists();
    const w = getImportedWordsByCollection(collectionName, folder);
    setWords(w);
    loadProgress(w);
  }

  const studyParam =`source=my-words&myCollection=${encodeURIComponent(collectionName)}&myFolder=${encodeURIComponent(folder)}`;

  return (
    <div className="flex flex-col min-h-screen animate-fade-in pb-24">
      <div className="flex items-center gap-3 p-4 border-b border-[var(--border)]">
        <button onClick={() => router.back()} className="btn-icon text-lg" aria-label={t.extra.goBack}>←</button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-[var(--text)] truncate">{collectionName}</h1>
          <p className="text-xs text-[var(--text-muted)] truncate">
            <span className="text-[var(--primary)]">📁 {folder}</span> · {t.myWords.wordCount(words.length)}
          </p>
        </div>
        {tab === 'words' && words.length > 0 && (
          <button
            onClick={toggleSelectMode}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${selectMode ? 'bg-[var(--primary)] text-white' : 'bg-[var(--surface-2)] text-[var(--text-muted)]'}`}
          >
            {selectMode ? t.libraryPage.cancel : t.libraryPage.select}
          </button>
        )}
        {tab === 'words' && words.length > 0 && !selectMode && (
          <CopyWordListButton words={words.map(w => w.word)} />
        )}
        {tab === 'words' && (
        <button
          onClick={requestDeleteCollection}
          className="btn-icon text-base text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
          aria-label={t.myWords.deleteCollectionAria}
        >🗑️</button>
        )}
      </div>

      <div className="px-4 pt-4 -mb-4">
        <UnitTabBar tab={tab} onChange={setTab} />
      </div>

      {/* Hidden rather than unmounted so a half-finished paste survives a tab switch. */}
      <div hidden={tab !== 'add'} className="p-4">
        <AiAddWordsPanel onAdd={addWords} onAdded={() => setTab('words')} />
      </div>

      {tab === 'words' && (<>
      {completedAt && (
        <div className="mx-4 mt-4 rounded-2xl px-4 py-3 flex items-center gap-2 font-bold animate-pop" style={{ background: 'rgba(34,197,94,0.12)', color: 'var(--success)', border: '1.5px solid var(--success)' }}>
          <span className="text-xl">🏆</span>
          <span>
            {t.myWords.completedBadge}
            {pendingNewWords.length > 0 && (
              <span className="text-[var(--text-muted)] font-normal"> · {t.myWords.newWordsToLearn(pendingNewWords.length)}</span>
            )}
          </span>
        </div>
      )}

      <div className="p-4 space-y-4">
        {words.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">📝</div>
            <h2 className="text-xl font-bold text-[var(--text)] mb-2">{t.libraryPage.noWordsYet}</h2>
            <p className="text-sm text-[var(--text-muted)] mb-6">{t.libraryPage.goToAddWords}</p>
            <button onClick={() => setTab('add')} className="px-6 py-3 rounded-xl text-sm font-bold text-white" style={{ background: 'var(--primary)' }}>{t.libraryPage.addWords}</button>
          </div>
        ) : (
          <>
            {(() => {
              const done = [progress.learnDone, progress.flashcardDone, progress.quizDone, progress.matchDone].filter(Boolean).length;
              return (
                <div className="space-y-1.5">
                  <div className="h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
                    <div className="h-full rounded-full bg-[var(--primary)] transition-all duration-500" style={{ width: `${(done / 4) * 100}%` }} />
                  </div>
                  <p className="text-xs font-medium text-[var(--text-muted)]">{t.myWords.activitiesDone(done)}</p>
                </div>
              );
            })()}

            <div className="grid grid-cols-4 gap-2">
              <StudyButton
                href={`/learn?${studyParam}`}
                onlyNewHref={`/learn?${studyParam}&onlyNew=1`}
                icon="📖" label={t.home.learnTitle} color="var(--primary)"
                bg="rgba(108,99,255,0.1)" border="rgba(108,99,255,0.3)"
                done={progress.learnDone} pendingNew={pendingByActivity.learn}
                newBadgeLabel={t.myWords.pendingNewBadge(pendingByActivity.learn)}
              />
              <StudyButton
                href={`/flashcards?${studyParam}`}
                onlyNewHref={`/flashcards?${studyParam}&onlyNew=1`}
                icon="🃏" label={t.home.flashcardsTitle} color="#FF6B35"
                bg="rgba(255,107,53,0.1)" border="rgba(255,107,53,0.3)"
                done={progress.flashcardDone} pendingNew={pendingByActivity.flashcard}
                newBadgeLabel={t.myWords.pendingNewBadge(pendingByActivity.flashcard)}
              />
              <StudyButton
                href={`/quiz?${studyParam}`}
                onlyNewHref={`/quiz?${studyParam}&onlyNew=1`}
                icon="❓" label={t.home.quizTitle} color="var(--warning)"
                bg="rgba(245,158,11,0.1)" border="rgba(245,158,11,0.3)"
                done={progress.quizDone} pendingNew={pendingByActivity.quiz}
                newBadgeLabel={t.myWords.pendingNewBadge(pendingByActivity.quiz)}
              />
              <StudyButton
                href={`/matching?${studyParam}`}
                onlyNewHref={`/matching?${studyParam}&onlyNew=1`}
                icon="🔗" label={t.home.matchTitle} color="var(--success)"
                bg="rgba(16,185,129,0.1)" border="rgba(16,185,129,0.3)"
                done={progress.matchDone} pendingNew={pendingByActivity.match}
                newBadgeLabel={t.myWords.pendingNewBadge(pendingByActivity.match)}
              />
            </div>

            <div className="space-y-2">
              {words.map((w) => {
                const isSelected = selected.has(w.id);
                const open = !selectMode && expanded.has(w.id);
                const showAll = allExamples.has(w.id);
                const examples = showAll ? w.examples : w.examples.slice(0, PREVIEW_EXAMPLES);
                const hidden = w.examples.length - examples.length;
                return (
                  <div
                    key={w.id}
                    className={`rounded-2xl border px-3.5 py-3 cursor-pointer transition-colors ${open ? 'border-[var(--primary)] bg-[var(--primary-bg)]' : 'border-[var(--border)] bg-[var(--surface)]'} ${isSelected ? 'ring-2 ring-[var(--primary)]' : ''}`}
                    onClick={() => selectMode ? toggleSelected(w.id) : toggleIn(setExpanded, w.id)}
                  >
                    <div className="flex items-center gap-2">
                      {selectMode && (
                        <div
                          className={`w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center ${isSelected ? 'bg-[var(--primary)] border-[var(--primary)]' : 'border-[var(--border)]'}`}
                        >
                          {isSelected && <span className="text-white text-xs leading-none">✓</span>}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[var(--text)]">{w.word}</p>
                        <p className={`text-sm font-medium text-[var(--primary)] ${open ? '' : 'truncate'}`}>{w.translation}</p>
                      </div>
                      {!selectMode && (
                        <>
                          {w.examples.length > 0 && !open && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--primary-bg)] text-[var(--primary)] shrink-0">
                              {t.myWords.examplesCount(w.examples.length)}
                            </span>
                          )}
                          <button onClick={e => { e.stopPropagation(); speakText(w.word, w.language); }} className="w-8 h-8 rounded-full flex items-center justify-center text-sm hover:bg-[var(--primary-bg)] transition-colors shrink-0" aria-label={t.home.listen}>🔊</button>
                          <span className={`text-[var(--text-muted)] text-lg leading-none shrink-0 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}>›</span>
                        </>
                      )}
                    </div>
                    {open && (
                      <div className="mt-2.5 ml-0.5 pl-3 border-l-[3px] border-[var(--primary)] space-y-2 animate-fade-in" onClick={e => e.stopPropagation()}>
                        {w.definition && <p className="text-sm text-[var(--text-muted)] leading-snug">{w.definition}</p>}
                        {examples.map((ex, exIdx) => (
                          <div key={exIdx}>
                            <p className="text-sm italic text-[var(--text)]">&quot;{ex.sentence}&quot;</p>
                            {ex.translation && <p className="text-xs text-[var(--text-muted)] mt-0.5">↳ {ex.translation}</p>}
                          </div>
                        ))}
                        <div className="flex items-center">
                          {hidden > 0 && (
                            <button onClick={() => toggleIn(setAllExamples, w.id)} className="text-xs font-semibold text-[var(--primary)]">
                              {t.myWords.moreExamples(hidden)}
                            </button>
                          )}
                          <button onClick={() => requestDelete(w.id)} className="ml-auto text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors text-sm" aria-label={t.classesPage.deleteWord}>🗑️</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {!selectMode && (
            <button
              onClick={() => setTab('add')}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl border-2 border-dashed border-[var(--border)] text-sm font-medium text-[var(--text-muted)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
            >
              <span>+</span>
              <span>{t.myWords.addWords}</span>
            </button>
            )}
          </>
        )}
      </div>
      </>)}

      {selectMode && selected.size > 0 && (
        <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl bg-[var(--surface)] border border-[var(--border)]">
          <span className="text-sm font-semibold text-[var(--text)]">{t.myWords.selectedCount(selected.size)}</span>
          <button
            onClick={requestDeleteSelected}
            className="px-4 py-2 rounded-xl text-sm font-bold text-white"
            style={{ background: 'var(--danger)' }}
          >
            🗑️ {t.libraryPage.delete}
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
                {t.libraryPage.cancel}
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: 'var(--danger)' }}
              >
                {t.libraryPage.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// An activity button that's aware of its own "new words since I was last
// done" count — independent of the other three activities. When done and
// there are pending new words, tapping jumps straight into a session with
// just those words instead of the full set.
function StudyButton({
  href, onlyNewHref, icon, label, color, bg, border, done, pendingNew, newBadgeLabel,
}: {
  href: string; onlyNewHref: string; icon: string; label: string;
  color: string; bg: string; border: string; done: boolean; pendingNew: number;
  newBadgeLabel: string;
}) {
  const target = done && pendingNew > 0 ? onlyNewHref : href;
  return (
    <Link
      href={target}
      className="relative flex flex-col items-center gap-1 py-3 px-1 rounded-2xl text-center transition-colors min-w-0"
      style={{ background: bg, border: `1.5px solid ${border}` }}
    >
      {done && <span className="absolute top-1 right-1 text-xs">✅</span>}
      <span className="text-2xl">{icon}</span>
      <span className="text-[11px] font-semibold truncate max-w-full" style={{ color }}>{label}</span>
      {done && pendingNew > 0 && (
        <span
          className="absolute -top-1.5 -left-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
          style={{ background: 'var(--success)' }}
        >
          {newBadgeLabel}
        </span>
      )}
    </Link>
  );
}
