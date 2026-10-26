'use client';
import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/useTranslation';
import { deleteImportedFolder, getCollectionsByFolder, getMyUnitProgress, getMyActivityPendingNewWords, getImportedWordsByCollection, isMyFolderLocked, setMyFolderLocked } from '@/lib/storage';
import { CopyFolderWordListButton, CopyWordListButton } from '@/components/CopyWordList';
import { UnitCardFrame, ModeButton } from '@/components/UnitStudyCard';
import { pushLists, pullAll } from '@/lib/sync';
import type { MyUnitProgress } from '@/lib/types';

// Same purple hero as the pre-built collections' default (app/collections/[name]).
const HERO = {
  gradient: 'linear-gradient(135deg, #6c63ff 0%, #9b8fff 100%)',
  glow: 'rgba(108,99,255,0.45)',
};

type Activity = 'learn' | 'flashcard' | 'quiz' | 'match';

interface UnitRow {
  name: string;
  words: string[];
  progress: MyUnitProgress;
  pending: Record<Activity, number>;
}

// Oldest first, so Unit 1 is the first unit made — the order pre-built
// collections number theirs in.
function loadRows(folder: string): UnitRow[] {
  return getCollectionsByFolder(folder)
    .sort((a, b) => a.addedAt - b.addedAt)
    .map(c => {
      const words = getImportedWordsByCollection(c.name, folder).map(w => w.word);
      const pendingOf = (a: Activity) => getMyActivityPendingNewWords(folder, c.name, a, words).length;
      return {
        name: c.name,
        words,
        progress: getMyUnitProgress(folder, c.name),
        pending: { learn: pendingOf('learn'), flashcard: pendingOf('flashcard'), quiz: pendingOf('quiz'), match: pendingOf('match') },
      };
    });
}

const isUnitComplete = (p: MyUnitProgress) => p.learnDone && p.flashcardDone && p.quizDone && p.matchDone;

interface Props {
  params: Promise<{ collection: string }>;
}

export default function FolderPage({ params }: Props) {
  const { collection: encodedSlug } = use(params);
  const folder = decodeURIComponent(encodedSlug);
  const router = useRouter();
  const t = useTranslation();
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [locked, setLocked] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    const load = () => {
      setUnits(loadRows(folder));
      setLocked(isMyFolderLocked(folder));
    };
    load();
    pullAll().then(load);
    // Refresh when coming back from a study session, so its ✓ shows up.
    window.addEventListener('focus', load);
    document.addEventListener('visibilitychange', load);
    return () => {
      window.removeEventListener('focus', load);
      document.removeEventListener('visibilitychange', load);
    };
  }, [folder]);

  const totalWords = units.reduce((s, u) => s + u.words.length, 0);
  const completedUnits = units.filter(u => isUnitComplete(u.progress)).length;
  const progressPct = units.length > 0 ? (completedUnits / units.length) * 100 : 0;

  function toggleLock() {
    const next = !locked;
    setMyFolderLocked(folder, next);
    pushLists();
    setLocked(next);
    setToast(next ? t.myWords.orderLockedToast : t.myWords.orderFreeToast);
    setTimeout(() => setToast(null), 2000);
  }

  function handleDeleteFolder() {
    if (!confirm(t.extra.deleteEntireFolderConfirm(folder))) return;
    deleteImportedFolder(folder);
    pushLists();
    router.push('/my-words');
  }

  // Same "New unit" modal as Library (app/library/[folderId]). My Words units
  // only exist once they hold words, so instead of saving an empty unit this
  // opens it straight away on its Words / Add words tabs.
  function createUnit() {
    const name = newName.trim();
    if (!name) return;
    setShowCreate(false);
    router.push(`/my-words/${encodeURIComponent(folder)}/${encodeURIComponent(name)}`);
  }

  const heroIconBtn = 'w-9 h-9 rounded-full bg-black/20 hover:bg-black/30 flex items-center justify-center text-base transition-colors';

  return (
    <div className="flex flex-col min-h-screen pb-24 animate-fade-in">

      {/* ── Hero banner ── */}
      <div className="relative px-5 pt-5 pb-8" style={{ background: HERO.gradient, boxShadow: `0 8px 32px ${HERO.glow}` }}>
        <div className="flex items-center justify-between gap-2 mb-4">
          <Link href="/my-words" className="flex items-center gap-1.5 text-sm text-white/80 hover:text-white transition-colors">
            ← {t.myWords.title}
          </Link>
          <div className="flex items-center gap-2">
            {units.length > 0 && (
              <CopyFolderWordListButton
                units={units.map(u => ({ name: u.name, count: u.words.length }))}
                loadWords={() => units.map(u => u.words)}
                className={heroIconBtn}
              />
            )}
            <button
              onClick={handleDeleteFolder}
              className={heroIconBtn}
              aria-label={t.extra.deleteFolderAria}
              title={t.extra.deleteFolderAria}
            >🗑</button>
          </div>
        </div>

        <h1 className="text-2xl font-black text-white leading-tight mb-3 break-words" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
          {folder}
        </h1>

        {/* Stat pills */}
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            t.collections.unitsCount(units.length),
            t.collections.wordsCount(totalWords),
            t.collections.completed(completedUnits, units.length),
          ].map(label => (
            <span key={label} className="flex items-center gap-1 text-xs font-semibold bg-black/25 text-white rounded-full px-3 py-1">
              {label}
            </span>
          ))}
        </div>

        {/* Progress bar */}
        <div className="h-2 rounded-full bg-white/25 overflow-hidden mb-4">
          <div className="h-full rounded-full bg-white transition-all duration-700" style={{ width: `${progressPct}%` }} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => { setNewName(''); setShowCreate(true); }}
            className="px-4 py-2 rounded-xl text-sm font-bold bg-white hover:bg-white/90 transition-colors"
            style={{ color: '#6c63ff' }}
          >+ {t.libraryPage.newUnit}</button>
          <button
            onClick={toggleLock}
            title={t.myWords.orderToggleHint}
            aria-pressed={locked}
            className={`px-3.5 py-2 rounded-xl text-sm font-bold transition-colors ${locked ? 'bg-black/35 text-white' : 'bg-white/15 text-white/90 hover:bg-white/25'}`}
          >{locked ? `🔒 ${t.myWords.orderLocked}` : `🔓 ${t.myWords.orderFree}`}</button>
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-bold text-[var(--text)] mb-4">{t.libraryPage.newUnit}</h2>
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createUnit(); if (e.key === 'Escape') setShowCreate(false); }}
              placeholder={t.libraryPage.unitNamePlaceholder}
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--surface-2)] text-[var(--text)] text-sm border border-[var(--border)] outline-none focus:border-[var(--primary)] mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--surface-2)]">{t.libraryPage.cancel}</button>
              <button onClick={createUnit} disabled={!newName.trim()} className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-[var(--primary)] disabled:opacity-50">
                {t.libraryPage.create}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Units grid ── */}
      {units.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <div className="text-6xl">📂</div>
          <p className="text-[var(--text-muted)] text-sm">{t.extra.noUnitsTapPlus}</p>
          <button onClick={() => { setNewName(''); setShowCreate(true); }} className="btn-primary px-6 py-3 text-sm font-semibold">
            {t.libraryPage.newUnit}
          </button>
        </div>
      ) : (
        <div className="p-3 grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))' }}>
          {units.map((unit, i) => (
            <MyUnitCard key={unit.name} unit={unit} index={i} folder={folder} folderLocked={locked} />
          ))}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-xl text-sm font-semibold shadow-xl bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  );
}

function MyUnitCard({ unit, index, folder, folderLocked }: {
  unit: UnitRow; index: number; folder: string; folderLocked: boolean;
}) {
  const t = useTranslation();
  const { learnDone, flashcardDone, quizDone, matchDone } = unit.progress;
  const done = [learnDone, flashcardDone, quizDone, matchDone].filter(Boolean).length;
  const isComplete = done === 4;
  const unitHref = `/my-words/${encodeURIComponent(folder)}/${encodeURIComponent(unit.name)}`;
  const studyParam = `source=my-words&myCollection=${encodeURIComponent(unit.name)}&myFolder=${encodeURIComponent(folder)}`;
  // Activity already done + words added since → jump to just the new ones.
  const hrefFor = (path: string, activity: Activity, activityDone: boolean) =>
    `/${path}?${studyParam}${activityDone && unit.pending[activity] > 0 ? '&onlyNew=1' : ''}`;
  const badgeFor = (activity: Activity, activityDone: boolean) =>
    activityDone && unit.pending[activity] > 0 ? t.myWords.pendingNewBadge(unit.pending[activity]) : undefined;
  // Only when the learner turned "in order" on for this folder; new words
  // added after Learn don't re-lock a unit (the "N new" badge covers them).
  const gated = folderLocked && !learnDone;

  return (
    <UnitCardFrame
      badge={t.collections.unit(index + 1)}
      isComplete={isComplete}
      accent={HERO.gradient}
      progressPct={(done / 4) * 100}
      badges={<>
        <span className="text-[10px] text-[var(--text-muted)]">{t.collections.unitWordsLabel(unit.words.length)}</span>
        {isComplete && <span className="text-[10px] font-bold text-green-500">{t.collectionsPage.doneCheckmark}</span>}
      </>}
      title={
        <Link href={unitHref} className="block font-bold text-[var(--text)] text-sm leading-tight truncate hover:text-[var(--primary)] transition-colors">
          {unit.name}
        </Link>
      }
      actions={<>
        <CopyWordListButton words={unit.words} className="text-sm opacity-50 hover:opacity-90 transition-opacity" />
        <Link
          href={unitHref}
          className="text-[11px] font-bold px-2 py-1 rounded-lg bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors"
        >✏️ {t.myWords.wordsBtn}</Link>
      </>}
    >
      <div className="grid grid-cols-3 gap-2">
        <ModeButton href={hrefFor('learn', 'learn', learnDone)} newBadge={badgeFor('learn', learnDone)} icon="📖" label={t.nav.learn} done={learnDone} color="#4f46e5" />
        <ModeButton
          href={hrefFor('flashcards', 'flashcard', flashcardDone)} newBadge={badgeFor('flashcard', flashcardDone)}
          icon="🃏" label={t.collectionsPage.cardsLabel} done={flashcardDone} color="#ea580c"
          locked={gated} lockReason={t.collections.completeLearnFirst}
        />
        <ModeButton
          href={hrefFor('quiz', 'quiz', quizDone)} newBadge={badgeFor('quiz', quizDone)}
          icon="❓" label={t.nav.quiz} done={quizDone} color="#d97706"
          locked={gated} lockReason={t.collections.completeLearnFirst}
        />
      </div>
      <ModeButton
        href={hrefFor('matching', 'match', matchDone)} newBadge={badgeFor('match', matchDone)}
        icon="🎯" label={t.collectionsPage.matchLabel} done={matchDone} color="#db2777" wide
        locked={gated} lockReason={t.collections.completeLearnFirst}
      />
    </UnitCardFrame>
  );
}
