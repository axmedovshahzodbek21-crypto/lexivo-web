'use client';
import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { getUnitProgress, getLearnProgress, getHardWordCount, getFlashcardProgress, getStoryUnlockInfo } from '@/lib/storage';
import type { WordDay } from '@/lib/types';
import { useTranslation } from '@/lib/useTranslation';
import { supabase } from '@/lib/supabase';
import { CopyWordListButton } from '@/components/CopyWordList';
import { UnitCardFrame } from '@/components/UnitStudyCard';
import { UnitModeButtons, UnitNextStep } from '@/components/UnitModeHub';

const MODES = ['learn', 'flashcard', 'quiz', 'match'];
const ACCENT = 'linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 75%, transparent) 100%)';

export default function UnitPage({ params }: { params: Promise<{ name: string; day: string }> }) {
  const { name: encodedName, day: dayParam } = use(params);
  const collectionName = decodeURIComponent(encodedName);
  const t = useTranslation();
  const { collections, collectionsLoaded } = useAppStore();

  if (!collectionsLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-4xl animate-bounce">📚</div>
      </div>
    );
  }

  const day = collections.find(c => c.name === collectionName)?.days.find(d => d.dayNumber === parseInt(dayParam));
  if (!day || day.words.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-[var(--text-muted)]">{t.collections.notFound}</p>
        <Link href={`/collections/${encodedName}`} className="btn-primary inline-block mt-4">{t.collections.back}</Link>
      </div>
    );
  }
  return <UnitHub key={day.dayNumber} day={day} collectionName={collectionName} />;
}

function UnitHub({ day, collectionName }: { day: WordDay; collectionName: string }) {
  const t = useTranslation();
  const router = useRouter();
  const dayNumber = day.dayNumber;
  const wordList = day.words.map(w => w.word);

  const [progress] = useState(() => getUnitProgress(collectionName, dayNumber));
  const [learnProgress] = useState(() => getLearnProgress(collectionName, dayNumber));
  const [hardCount] = useState(() => getHardWordCount(collectionName, dayNumber));
  const [flashcardProgress] = useState(() => getFlashcardProgress(collectionName, dayNumber)?.length ?? 0);
  const [storyInfo] = useState(() => getStoryUnlockInfo(collectionName, dayNumber, day.words.length));
  const [showInfo, setShowInfo] = useState(false);
  const [activeStory, setActiveStory] = useState<{ num: number; title: string; content: string } | null>(null);
  const [storyLoading, setStoryLoading] = useState(false);
  const [tappedWord, setTappedWord] = useState<string | null>(null);

  const { learnDone, flashcardDone, quizDone, matchDone } = progress;
  const completed = new Set(MODES.filter((_, i) => [learnDone, flashcardDone, quizDone, matchDone][i]));
  const isComplete = learnDone && flashcardDone && quizDone;
  const isLocked = (mode: string) => mode !== 'learn' && !learnDone;

  const enc = encodeURIComponent(collectionName);
  const query = `collection=${enc}&day=${dayNumber}`;
  const learnUrl = `/learn?${query}`;
  const flashUrl = `/flashcards?${query}`;
  const resumeUrl = !learnDone && learnProgress && learnProgress > 0 ? `${learnUrl}&startIndex=${learnProgress}` : null;
  const urls: Record<string, string> = {
    learn: resumeUrl ?? learnUrl,
    flashcard: flashUrl,
    quiz: `/quiz?${query}`,
    match: `/matching?${query}`,
  };
  const start = (mode: string) => router.push(urls[mode]);

  const nextMode = MODES.find(m => !completed.has(m)) ?? null;
  // The Quiz page sends anyone without finished Flashcards back to them, so
  // offering "Skip to Quiz" here would only bounce.
  const skipMode = nextMode
    ? MODES.find(m => m !== nextMode && !completed.has(m) && !isLocked(m) && !(m === 'quiz' && !flashcardDone)) ?? null
    : null;

  const openStory = async (storyNumber: number) => {
    setStoryLoading(true);
    setActiveStory({ num: storyNumber, title: '', content: '' });
    const { data } = await supabase
      .from('unit_stories')
      .select('title, content')
      .eq('collection_name', collectionName)
      .eq('unit_number', dayNumber)
      .eq('story_number', storyNumber)
      .maybeSingle();
    setActiveStory({ num: storyNumber, title: data?.title ?? '', content: data?.content ?? '' });
    setStoryLoading(false);
  };

  const storyEmojis = ['📖', '📕', '📗'];
  const storyLabels = [t.collectionsPage.story1Label, t.collectionsPage.story2Label, t.collectionsPage.story3Label];
  const storyFlags = [storyInfo.story1Unlocked, storyInfo.story2Unlocked, storyInfo.story3Unlocked];
  const hasTopic = !/^Unit \d+$/.test(day.topic);

  return (
    <>
    <div className="flex flex-col min-h-screen animate-fade-in pb-24">
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <button onClick={() => router.replace(`/collections/${enc}`)} className="btn-icon" aria-label={t.extra.goBack}>←</button>
        <div className="min-w-0">
          <p className="text-xs text-[var(--text-muted)] font-medium truncate">{collectionName}</p>
          <p className="font-bold text-[var(--text)] text-sm truncate">{hasTopic ? day.topic : t.collections.unit(dayNumber)}</p>
        </div>
      </div>

      <div className="p-3 space-y-3">
        <UnitCardFrame
          badge={t.collections.unit(dayNumber)}
          isComplete={isComplete}
          accent={ACCENT}
          progressPct={(completed.size / MODES.length) * 100}
          badges={<>
            <span className="text-[10px] text-[var(--text-muted)]">{t.collections.unitWordsLabel(day.words.length)}</span>
            {isComplete && <span className="text-[10px] font-bold text-green-500">{t.collectionsPage.doneCheckmark}</span>}
          </>}
          title={hasTopic && <h1 className="font-bold text-[var(--text)] text-sm leading-tight">{day.topic}</h1>}
          actions={<>
            <CopyWordListButton words={wordList} className="text-sm opacity-50 hover:opacity-90 transition-opacity" />
            <button
              onClick={() => setShowInfo(true)}
              className="text-sm opacity-40 hover:opacity-80 transition-opacity"
              aria-label={t.collections.howMarking}
            >🕯️</button>
          </>}
        >
          <p className="text-[10px] text-[var(--text-muted)] -mt-1.5">{t.classesPage.modesDone(completed.size, MODES.length)}</p>
          <UnitModeButtons modes={MODES} completed={completed} isLocked={isLocked} onStart={start} />
        </UnitCardFrame>

        {resumeUrl && (
          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[var(--primary-bg)] border border-[var(--primary)] border-opacity-30">
            <span className="text-xs text-[var(--primary)]">{t.collections.savedAtWord((learnProgress ?? 0) + 1)}</span>
            <Link href={learnUrl} className="text-xs text-[var(--text-muted)] hover:underline">{t.collections.restart}</Link>
          </div>
        )}
        {!flashcardDone && flashcardProgress > 0 && (
          <div
            className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl"
            style={{ background: 'rgba(234,88,12,0.08)', border: '1px solid rgba(234,88,12,0.25)' }}
          >
            <span className="text-xs font-medium" style={{ color: '#ea580c' }}>{t.collections.cardsRemaining(flashcardProgress)}</span>
            <Link href={`${flashUrl}&fresh=true`} className="text-xs text-[var(--text-muted)] hover:underline">{t.collections.restart}</Link>
          </div>
        )}

        {nextMode && (
          <UnitNextStep
            nextMode={nextMode}
            skipMode={skipMode}
            wordCount={day.words.length}
            isLocked={isLocked}
            onStart={start}
            hint={nextMode === 'flashcard' && hardCount > 0 ? t.collectionsPage.cardsLabelCount(hardCount) : undefined}
          />
        )}

        {storyInfo.anyUnlocked && (
          <div>
            <p className="text-[10px] font-bold text-[var(--text-muted)] tracking-widest uppercase mb-2">{t.collectionsPage.storiesHeader}</p>
            <div className="flex flex-col gap-1.5">
              {storyFlags.map((unlocked, i) => (
                <button
                  key={i}
                  disabled={!unlocked}
                  onClick={() => unlocked && openStory(i + 1)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all text-xs font-semibold ${
                    unlocked
                      ? 'bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100'
                      : 'bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-muted)] opacity-40 cursor-not-allowed'
                  }`}
                >
                  <span>{storyEmojis[i]}</span>
                  <span className="flex-1">{storyLabels[i]}</span>
                  <span>{unlocked ? '→' : '🔒'}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-[10px] font-bold text-[var(--text-muted)] tracking-widest uppercase mb-2">{t.classesPage.wordsInThisUnit}</p>
          <div className="space-y-1.5">
            {day.words.map(w => (
              <div key={w.word} className="p-2.5 bg-[var(--surface)] rounded-lg">
                <p className="font-bold text-xs text-[var(--text)]">{w.word}</p>
                <p className="text-[11px] text-[var(--primary)] font-semibold mt-0.5">{w.translation}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>

      {/* Story reader modal */}
      {activeStory && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setActiveStory(null)}
        >
          <div
            className="card max-w-lg w-full max-h-[85vh] flex flex-col animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3 shrink-0">
              <span className="text-sm font-bold text-[var(--text)]">
                {storyEmojis[activeStory.num - 1]} {storyLabels[activeStory.num - 1]}
              </span>
              <button
                onClick={() => setActiveStory(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text)] text-lg leading-none"
              >×</button>
            </div>
            {storyLoading ? (
              <div className="flex-1 flex items-center justify-center py-12">
                <div className="text-2xl animate-bounce">📖</div>
              </div>
            ) : activeStory.content.trim() ? (
              <div className="overflow-y-auto flex flex-col gap-3">
                {activeStory.title && (
                  <h2 className="text-lg font-bold text-[var(--text)]">{activeStory.title}</h2>
                )}
                <p className="text-sm text-[var(--text)] leading-relaxed whitespace-pre-wrap">
                  {activeStory.content.split(/\[\[([^\]]+)\]\]/).map((part, i) =>
                    i % 2 === 1 ? (
                      <button
                        key={i}
                        onClick={() => setTappedWord(part)}
                        className="inline font-semibold rounded px-0.5 transition-opacity hover:opacity-75"
                        style={{ color: 'var(--primary)', background: 'color-mix(in srgb, var(--primary) 12%, transparent)' }}
                      >{part}</button>
                    ) : <span key={i}>{part}</span>
                  )}
                </p>
                {tappedWord && (
                  <div
                    className="shrink-0 rounded-xl p-3 flex items-center gap-3"
                    style={{ background: 'var(--primary-bg)', border: '1px solid color-mix(in srgb, var(--primary) 25%, transparent)' }}
                  >
                    <span className="text-base font-bold flex-1" style={{ color: 'var(--primary)' }}>📖 {tappedWord}</span>
                    <button
                      onClick={() => { setTappedWord(null); setActiveStory(null); }}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg text-white shrink-0"
                      style={{ background: 'var(--primary)' }}
                    >{t.extra.goToUnit}</button>
                    <button
                      onClick={() => setTappedWord(null)}
                      className="text-lg leading-none shrink-0"
                      style={{ color: 'var(--text-muted)' }}
                    >×</button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
                <span className="text-4xl mb-3">{storyEmojis[activeStory.num - 1]}</span>
                <p className="font-semibold text-[var(--text)] mb-1">{t.extra.storyComingSoon}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {t.collectionsPage.storyUnlockedNotWritten}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

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
                { icon: '📖', label: t.nav.learn, desc: t.collections.markingLearn },
                { icon: '🃏', label: t.nav.flashcards, desc: t.collections.markingFlash },
                { icon: '❓', label: t.nav.quiz, desc: t.collections.markingQuiz },
                { icon: '🏆', label: t.collectionsPage.unitCompleteLabel, desc: t.collections.markingUnit },
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
            <button onClick={() => setShowInfo(false)} className="btn-primary w-full mt-4">
              {t.common.gotIt}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
