'use client';
import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { getUnitProgress, getLearnProgress, getHardWordCount, getFlashcardProgress } from '@/lib/storage';
import type { WordCollection, UnitProgress } from '@/lib/types';
import { useTranslation } from '@/lib/useTranslation';

interface UnitRow {
  dayNumber: number;
  topic: string;
  wordCount: number;
  progress: UnitProgress;
}

export default function CollectionPage({ params }: { params: Promise<{ name: string }> }) {
  const { name: encodedName } = use(params);
  const collectionName = decodeURIComponent(encodedName);
  const router = useRouter();
  const t = useTranslation();
  const { collections, collectionsLoaded } = useAppStore();

  const [collection, setCollection] = useState<WordCollection | null>(null);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [cols, setCols] = useState(2);

  useEffect(() => {
    // Use window.innerWidth (not element clientWidth) so Ctrl+zoom actually changes columns.
    // Content is constrained by max-w-2xl so element width doesn't change with zoom.
    const MIN_CARD = 320;
    const GAP = 8;
    const calculate = () => {
      const sidebarOpen = localStorage.getItem('lexivo_sidebar_open') !== 'false';
      const sidebarW = window.innerWidth >= 768 && sidebarOpen ? 208 : 0;
      const available = window.innerWidth - sidebarW - 32;
      setCols(Math.max(1, Math.floor((available + GAP) / (MIN_CARD + GAP))));
    };
    calculate();
    window.addEventListener('resize', calculate);
    return () => window.removeEventListener('resize', calculate);
  }, []);

  useEffect(() => {
    if (!collectionsLoaded) return;
    const found = collections.find(c => c.name === collectionName);
    if (!found) return;
    setCollection(found);
    const rows: UnitRow[] = found.days.map(day => ({
      dayNumber: day.dayNumber,
      topic: day.topic || `Unit ${day.dayNumber}`,
      wordCount: day.words.length,
      progress: getUnitProgress(collectionName, day.dayNumber),
    }));
    setUnits(rows);
  }, [collectionsLoaded, collections, collectionName]);

  useEffect(() => {
    const handleSync = () => {
      if (!collection) return;
      setUnits(collection.days.map(day => ({
        dayNumber: day.dayNumber,
        topic: day.topic || `Unit ${day.dayNumber}`,
        wordCount: day.words.length,
        progress: getUnitProgress(collectionName, day.dayNumber),
      })));
    };
    window.addEventListener('lexivo-sync', handleSync);
    return () => window.removeEventListener('lexivo-sync', handleSync);
  }, [collection, collectionName]);

  if (!collectionsLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-4xl animate-bounce">📚</div>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="p-6 text-center">
        <p className="text-[var(--text-muted)]">{t.collections.notFound}</p>
        <Link href="/" className="btn-primary inline-block mt-4">{t.collections.back}</Link>
      </div>
    );
  }

  const totalWords = collection.days.reduce((a, d) => a + d.words.length, 0);
  const completedUnits = units.filter(u => u.progress.learnDone && u.progress.flashcardDone && u.progress.quizDone).length;

  return (
    <div className="flex flex-col min-h-screen animate-fade-in">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border)]">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-3 hover:text-[var(--text)] transition-colors"
        >
          {t.collections.back}
        </button>
        <h1 className="text-xl font-bold text-[var(--text)]">{collection.name}</h1>
        {collection.description && (
          <p className="text-sm text-[var(--text-muted)] mt-1">{collection.description}</p>
        )}
        <div className="flex gap-3 mt-3 text-sm text-[var(--text-muted)]">
          <span>{t.collections.unitsCount(units.length)}</span>
          <span>{t.collections.wordsCount(totalWords)}</span>
          <span>{t.collections.completed(completedUnits, units.length)}</span>
        </div>

        {/* Overall progress bar */}
        {units.length > 0 && (
          <div className="mt-3">
            <div className="progress-bar">
              <div
                className="progress-bar-fill"
                style={{ width: `${(completedUnits / units.length) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Units list — columns driven by window.innerWidth so Ctrl+zoom adjusts density */}
      <div
        className="flex-1 p-3 grid gap-2"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {units.map((unit) => (
          <UnitCard
            key={unit.dayNumber}
            unit={unit}
            collectionName={collectionName}
          />
        ))}
      </div>
    </div>
  );
}

function UnitCard({ unit, collectionName }: { unit: UnitRow; collectionName: string }) {
  const t = useTranslation();
  const { learnDone, flashcardDone, quizDone } = unit.progress;
  const stagesComplete = [learnDone, flashcardDone, quizDone].filter(Boolean).length;
  const isComplete = stagesComplete === 3;

  const [learnProgress, setLearnProgress] = useState<number | null>(null);
  const [hardCount, setHardCount] = useState(0);
  const [flashcardProgress, setFlashcardProgress] = useState(0);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    setLearnProgress(getLearnProgress(collectionName, unit.dayNumber));
    setHardCount(getHardWordCount(collectionName, unit.dayNumber));
    const fp = getFlashcardProgress(collectionName, unit.dayNumber);
    setFlashcardProgress(fp ? fp.length : 0);
  }, [collectionName, unit.dayNumber]);

  const enc = encodeURIComponent(collectionName);
  const resumeUrl = learnProgress && learnProgress > 0
    ? `/learn?collection=${enc}&day=${unit.dayNumber}&startIndex=${learnProgress}`
    : null;
  const learnUrl = `/learn?collection=${enc}&day=${unit.dayNumber}`;
  const flashUrl = `/flashcards?collection=${enc}&day=${unit.dayNumber}`;
  const quizUrl  = `/quiz?collection=${enc}&day=${unit.dayNumber}`;
  const pronUrl  = `/pronunciation?collection=${enc}&day=${unit.dayNumber}`;
  const matchUrl = `/matching?collection=${enc}&day=${unit.dayNumber}`;

  return (
    <div className={`card transition-all ${isComplete ? 'border-[var(--success)] bg-green-50' : ''}`}>
      {/* Unit header */}
      <div className="mb-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[var(--text-muted)]">{t.collections.unit(unit.dayNumber)}</span>
          <button
            onClick={() => setShowInfo(true)}
            className="text-sm leading-none opacity-60 hover:opacity-100 transition-opacity"
            title={t.collections.howMarking}
          >🕯️</button>
        </div>
        <h3 className="font-semibold text-sm text-[var(--text)] truncate mt-0.5">{unit.topic}</h3>
        <div className="flex items-center justify-between mt-1">
          <div className="flex gap-1">
            <StageIcon done={learnDone} icon="📖" label="Learn" />
            <StageIcon done={flashcardDone} icon="🃏" label="Cards" />
            <StageIcon done={quizDone} icon="❓" label="Quiz" />
          </div>
          {isComplete && <span className="text-xs text-[var(--success)] font-semibold">✓</span>}
        </div>
      </div>

      {/* Mini progress bar */}
      <div className="progress-bar mb-2" style={{ height: 3 }}>
        <div className="progress-bar-fill" style={{ width: `${(stagesComplete / 3) * 100}%`, height: 4 }} />
      </div>

      {/* Resume learn banner */}
      {!learnDone && resumeUrl && (
        <div className="flex items-center justify-between gap-2 mb-2 px-3 py-2 rounded-xl bg-[var(--primary-bg)] border border-[var(--primary)] border-opacity-30">
          <span className="text-xs text-[var(--primary)]">{t.collections.savedAtWord((learnProgress ?? 0) + 1)}</span>
          <div className="flex gap-2">
            <Link href={resumeUrl} className="text-xs font-semibold text-[var(--primary)] hover:underline">{t.collections.continueBtn}</Link>
            <span className="text-[var(--text-muted)]">·</span>
            <Link href={learnUrl} className="text-xs text-[var(--text-muted)] hover:underline">{t.collections.restart}</Link>
          </div>
        </div>
      )}

      {/* Resume flashcard banner */}
      {!flashcardDone && flashcardProgress > 0 && (
        <div className="flex items-center justify-between gap-2 mb-2 px-3 py-2 rounded-xl bg-purple-50 border border-purple-200">
          <span className="text-xs text-purple-600">{t.collections.cardsRemaining(flashcardProgress)}</span>
          <div className="flex gap-2">
            <Link href={flashUrl} className="text-xs font-semibold text-purple-600 hover:underline">{t.collections.continueBtn}</Link>
            <span className="text-[var(--text-muted)]">·</span>
            <Link href={`${flashUrl}&fresh=true`} className="text-xs text-[var(--text-muted)] hover:underline">{t.collections.restart}</Link>
          </div>
        </div>
      )}

      {/* Learning path */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        <ModeButton href={learnUrl} icon="📖" label="Learn" done={learnDone} color="#6C63FF" />
        <ModeButton
          href={flashUrl} icon="🃏" label={hardCount > 0 ? `Cards (${hardCount})` : 'Cards'} done={flashcardDone} color="#FF6B35"
          locked={!learnDone} lockReason={t.collections.completeLearnFirst}
        />
        <ModeButton
          href={quizUrl} icon="❓" label="Quiz" done={quizDone} color="#F59E0B"
          locked={!learnDone} lockReason={t.collections.completeLearnFirst}
          softLocked={learnDone && !flashcardDone}
          softLockReason={t.collections.hardWordsRemain}
        />
      </div>

      {/* Extra activities */}
      <div className="grid grid-cols-2 gap-2">
        <ModeButton href={pronUrl}  icon="🎙️" label="Speak" done={false} color="#8B5CF6" />
        <ModeButton href={matchUrl} icon="🎯" label="Match" done={false} color="#EC4899" />
      </div>

      {/* Marking info modal */}
      {showInfo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={() => setShowInfo(false)}
        >
          <div
            className="card max-w-sm w-full animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-bold text-lg mb-4 text-center">{t.collections.markingModal}</h3>
            <div className="space-y-3">
              {[
                { icon: '📖', label: 'Learn', desc: t.collections.markingLearn },
                { icon: '🃏', label: 'Flashcards', desc: t.collections.markingFlash },
                { icon: '❓', label: 'Quiz', desc: t.collections.markingQuiz },
                { icon: '🏆', label: 'Unit Complete', desc: t.collections.markingUnit },
              ].map(({ icon, label, desc }) => (
                <div key={label} className="flex gap-3 items-start">
                  <span className="text-xl shrink-0">{icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-[var(--text)]">{label}</p>
                    <p className="text-xs text-[var(--text-muted)]">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowInfo(false)}
              className="btn-primary w-full mt-4"
            >{t.common.gotIt}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function StageIcon({ done, icon, label }: { done: boolean; icon: string; label: string }) {
  return (
    <div
      title={label}
      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs transition-all ${
        done
          ? 'bg-[var(--success)] text-white'
          : 'bg-[var(--surface-2)] text-[var(--text-muted)]'
      }`}
    >
      {done ? '✓' : icon}
    </div>
  );
}

function ModeButton({
  href, icon, label, done, color, locked, lockReason, softLocked, softLockReason,
}: {
  href: string; icon: string; label: string; done: boolean; color: string;
  locked?: boolean; lockReason?: string;
  softLocked?: boolean; softLockReason?: string;
}) {
  if (locked) {
    return (
      <div
        title={lockReason}
        className="flex flex-col items-center gap-1 py-2 rounded-xl text-xs font-medium border-2 border-dashed border-[var(--border)] text-[var(--text-muted)] opacity-50 cursor-not-allowed select-none"
      >
        <span className="text-base">🔒</span>
        <span>{label}</span>
      </div>
    );
  }
  if (softLocked) {
    return (
      <Link
        href={href}
        title={softLockReason}
        className="flex flex-col items-center gap-1 py-2 rounded-xl text-xs font-medium border-2 border-orange-300 text-orange-500 hover:bg-orange-50 transition-all hover:scale-105"
      >
        <span className="text-base">⚠️</span>
        <span className="text-center leading-tight">{label}</span>
      </Link>
    );
  }
  return (
    <Link
      href={href}
      className={`flex flex-col items-center gap-1 py-2 rounded-xl text-xs font-medium transition-all hover:scale-105 ${
        done
          ? 'bg-green-100 text-[var(--success)] border border-[var(--success)]'
          : 'border-2 border-[var(--border)] text-[var(--text-muted)] hover:border-current'
      }`}
      style={done ? {} : { '--hover-color': color } as React.CSSProperties}
    >
      <span className="text-base">{done ? '✓' : icon}</span>
      <span>{label}</span>
    </Link>
  );
}
