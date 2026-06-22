'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { speak, speakText } from '@/lib/speech';
import { getDueWords, updateSRSWord, addXP, recordStudySession, unlockAchievement, getSRSWords, removeSRSWord, resetSRSWord } from '@/lib/storage';
import { stageLabel, stageColor } from '@/lib/srs';
import { checkAchievements } from '@/lib/gamification';
import { XP_PER_SRS } from '@/lib/types';
import type { SRSWord } from '@/lib/types';
import Link from 'next/link';
import { useTranslation } from '@/lib/useTranslation';

export default function SRSReviewPage() {
  const router = useRouter();
  const t = useTranslation();
  const { pushAchievement, setPendingLevelUp } = useAppStore();
  const [queue, setQueue] = useState<SRSWord[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<{ id: string; success: boolean }[]>([]);
  const [done, setDone] = useState(false);
  const [managing, setManaging] = useState(false);
  const [allWords, setAllWords] = useState<SRSWord[]>([]);

  const loadWords = useCallback(() => {
    const due = getDueWords();
    const shuffled = [...due].sort(() => Math.random() - 0.5);
    setQueue(shuffled);
    if (shuffled.length === 0) setDone(true);
    setAllWords(getSRSWords());
  }, []);

  useEffect(() => { loadWords(); }, [loadWords]);

  // Re-load when sync completes (pullAll fires 'lexivo-sync' on window)
  useEffect(() => {
    const handler = () => {
      const due = getDueWords();
      const shuffled = [...due].sort(() => Math.random() - 0.5);
      setAllWords(getSRSWords());
      if (shuffled.length > 0) {
        setQueue(shuffled);
        setIndex(0);
        setResults([]);
        setDone(false);
      }
    };
    window.addEventListener('lexivo-sync', handler);
    return () => window.removeEventListener('lexivo-sync', handler);
  }, []);

  const current = queue[index];

  useEffect(() => {
    setRevealed(false);
    if (current) { current.language ? speakText(current.word, current.language) : speak(current.word); }
  }, [current]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (managing) { if (e.key === 'Escape') setManaging(false); return; }
      if (!current) return;
      switch (e.key) {
        case ' ': case 'Enter': e.preventDefault(); if (!revealed) setRevealed(true); break;
        case 'ArrowRight': case 'k': case 'K': if (revealed) grade(true); break;
        case 'ArrowLeft': case 'j': case 'J': if (revealed) grade(false); break;
        case 's': case 'S': current.language ? speakText(current.word, current.language) : speak(current.word); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [current, revealed, managing]);

  const grade = useCallback((success: boolean) => {
    if (!current) return;
    updateSRSWord(current.id, success);
    if (success) {
      const { leveledUp, newLevel, newXp } = addXP(XP_PER_SRS, 'SRS Review');
      if (leveledUp) setPendingLevelUp({ level: newLevel, xp: newXp });
      unlockAchievement('srs_first');
    }
    recordStudySession();
    setResults(r => [...r, { id: current.id, success }]);
    const newAchievements = checkAchievements();
    newAchievements.forEach(pushAchievement);
    if (index + 1 >= queue.length) setDone(true);
    else setIndex(i => i + 1);
  }, [current, index, queue, pushAchievement, setPendingLevelUp]);

  const handleRemove = (id: string) => {
    removeSRSWord(id);
    setAllWords(prev => prev.filter(w => w.id !== id));
    setQueue(prev => prev.filter(w => w.id !== id));
  };

  const handleReset = (id: string) => {
    resetSRSWord(id);
    setAllWords(getSRSWords());
  };

  // ── Manage deck view ────────────────────────────────────────────────────────
  if (managing) {
    const mastered  = allWords.filter(w => w.reviewStage >= 4);
    const learning  = allWords.filter(w => w.reviewStage < 4);

    return (
      <div className="flex flex-col min-h-screen">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <button onClick={() => setManaging(false)} className="btn-icon">←</button>
          <h1 className="font-bold">Manage SRS Deck</h1>
          <span className="text-sm text-[var(--text-muted)]">{allWords.length} words</span>
        </div>

        {allWords.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-6">
            <div className="text-5xl">📭</div>
            <p className="font-semibold text-[var(--text)]">No words in your SRS deck yet</p>
            <p className="text-sm text-[var(--text-muted)]">Words are added automatically when you complete a learning session.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto p-4 space-y-4">
            {learning.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">
                  Learning · {learning.length}
                </h2>
                <div className="space-y-2">
                  {learning.map(w => (
                    <WordManageRow key={w.id} word={w} onRemove={handleRemove} onReset={handleReset} />
                  ))}
                </div>
              </section>
            )}
            {mastered.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">
                  Mastered · {mastered.length}
                </h2>
                <div className="space-y-2">
                  {mastered.map(w => (
                    <WordManageRow key={w.id} word={w} onRemove={handleRemove} onReset={handleReset} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── No due words ─────────────────────────────────────────────────────────────
  if (done && queue.length === 0) {
    return (
      <div className="p-6 text-center flex flex-col items-center justify-center min-h-screen animate-fade-in">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold mb-2">{t.srs.allCaughtUp}</h2>
        <p className="text-[var(--text-muted)] mb-6">{t.srs.noDueWords}</p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Link href="/" className="btn-primary text-center">{t.srs.goHome}</Link>
          <button onClick={() => { setAllWords(getSRSWords()); setManaging(true); }} className="btn-secondary">
            Manage deck ({allWords.length} words)
          </button>
        </div>
      </div>
    );
  }

  // ── Session done ──────────────────────────────────────────────────────────
  if (done) {
    const correctCount = results.filter(r => r.success).length;
    const score = Math.round((correctCount / results.length) * 100);
    return (
      <div className="p-6 text-center flex flex-col items-center justify-center min-h-screen animate-fade-in">
        <div className="text-6xl mb-4">{score >= 80 ? '🧠' : '💪'}</div>
        <h2 className="text-2xl font-bold mb-2">{t.srs.reviewComplete}</h2>
        <p className="text-[var(--text-muted)] mb-6">{correctCount}/{results.length} correct · +{correctCount * XP_PER_SRS} XP</p>
        <div className="grid grid-cols-3 gap-3 w-full mb-6">
          <div className="card text-center"><div className="text-xl font-bold text-[var(--success)]">{correctCount}</div><div className="text-xs text-[var(--text-muted)]">{t.srs.correct}</div></div>
          <div className="card text-center"><div className="text-xl font-bold text-[var(--danger)]">{results.length - correctCount}</div><div className="text-xs text-[var(--text-muted)]">{t.srs.incorrect}</div></div>
          <div className="card text-center"><div className="text-xl font-bold text-[var(--primary)]">{score}%</div><div className="text-xs text-[var(--text-muted)]">{t.srs.score}</div></div>
        </div>
        <div className="flex gap-3 w-full mb-3">
          <button onClick={() => { setIndex(0); setRevealed(false); setResults([]); setDone(false); }} className="btn-secondary flex-1">{t.common.redo}</button>
          <Link href="/" className="btn-primary flex-1 text-center">{t.srs.goHome}</Link>
        </div>
        <button onClick={() => { setAllWords(getSRSWords()); setManaging(true); }} className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] underline">
          Manage deck
        </button>
      </div>
    );
  }

  if (!current) return null;

  const progress = ((index + 1) / queue.length) * 100;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <button onClick={() => router.back()} className="btn-icon">←</button>
        <div className="text-center">
          <div className="font-semibold text-sm">{t.srs.title}</div>
          <div className="text-xs text-[var(--text-muted)]">{index + 1} / {queue.length}</div>
        </div>
        <button
          onClick={() => { setAllWords(getSRSWords()); setManaging(true); }}
          className="btn-icon text-sm"
          title="Manage deck"
        >
          ⚙️
        </button>
      </div>

      {/* Progress */}
      <div className="px-4">
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="flex-1 p-4 flex flex-col gap-4">
        {/* Stage badge */}
        <div className="flex justify-end">
          <div
            className="badge text-xs"
            style={{ background: `${stageColor(current.reviewStage)}20`, color: stageColor(current.reviewStage) }}
          >
            {stageLabel(current.reviewStage)}
          </div>
        </div>

        {/* Word card */}
        <div className="card animate-slide-up flex flex-col gap-3" style={{ minHeight: 280 }}>
          <div className="flex items-center justify-between">
            <span className="badge text-xs">{current.topic}</span>
            <button
              onClick={() => current.language ? speakText(current.word, current.language) : speak(current.word)}
              className="w-8 h-8 rounded-full bg-[var(--primary-bg)] flex items-center justify-center hover:bg-[var(--primary)] hover:text-white transition-colors"
              aria-label="Listen to pronunciation"
            >🔊</button>
          </div>

          <h2 className="text-3xl font-bold text-[var(--text)]">{current.word}</h2>
          <p className="text-sm text-[var(--text-muted)]">{current.partOfSpeech} · {current.pronunciation}</p>

          {revealed ? (
            <div className="space-y-3 animate-fade-in">
              <div className="bg-[var(--primary-bg)] rounded-xl p-3">
                <p className="text-xs font-semibold text-[var(--primary)] mb-1">{t.srs.translation}</p>
                <p className="text-lg font-semibold text-[var(--primary)]">{current.translation}</p>
              </div>
              <p className="text-sm text-[var(--text)]">{current.definition}</p>
              <div className="bg-[var(--surface-2)] rounded-xl p-3">
                <p className="text-xs italic text-[var(--text-muted)]">"{current.example1}"</p>
              </div>
              {current.collectionName !== 'my-words' && (
                <Link
                  href={`/word/${encodeURIComponent(current.word)}`}
                  className="text-xs text-[var(--primary)] font-medium hover:underline text-right block"
                >
                  {t.srs.fullDetails}
                </Link>
              )}
            </div>
          ) : (
            <button onClick={() => setRevealed(true)} className="mt-4 btn-secondary w-full">
              {t.srs.reveal}
            </button>
          )}
        </div>

        {/* Grade buttons */}
        {revealed && (
          <div className="flex gap-3 animate-slide-up">
            <button
              onClick={() => grade(false)}
              className="flex-1 py-4 rounded-xl border-2 border-[var(--danger)] text-[var(--danger)] font-bold text-base hover:bg-red-50 transition-colors flex flex-col items-center gap-1"
            >
              <span>✗</span>
              <span className="text-xs font-normal">{t.srs.forgot}</span>
            </button>
            <button
              onClick={() => grade(true)}
              className="flex-1 py-4 rounded-xl border-2 border-[var(--success)] text-[var(--success)] font-bold text-base hover:bg-green-50 transition-colors flex flex-col items-center gap-1"
            >
              <span>✓</span>
              <span className="text-xs font-normal">{t.srs.knewIt}</span>
            </button>
          </div>
        )}

        {/* SRS progress info */}
        <div className="card p-3 flex justify-between text-xs text-[var(--text-muted)]">
          <span>{t.srs.collection} {current.collectionName}</span>
          <span>Next review: after {current.reviewStage < 4 ? `${[1,3,7,14][current.reviewStage]} days` : 'mastered!'}</span>
        </div>
      </div>
    </div>
  );
}

// ── Word row in manage view ───────────────────────────────────────────────────

function WordManageRow({
  word, onRemove, onReset,
}: {
  word: SRSWord;
  onRemove: (id: string) => void;
  onReset: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState<'remove' | 'reset' | null>(null);
  const mastered = word.reviewStage >= 4;

  return (
    <div className="card flex items-center gap-3 py-3">
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[var(--text)] truncate">{word.word}</p>
        <p className="text-xs text-[var(--text-muted)] truncate">{word.translation}</p>
      </div>
      <span
        className="badge text-xs shrink-0"
        style={{ background: `${stageColor(word.reviewStage)}20`, color: stageColor(word.reviewStage) }}
      >
        {mastered ? 'Mastered' : stageLabel(word.reviewStage)}
      </span>

      {confirming === 'reset' ? (
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => { onReset(word.id); setConfirming(null); }}
            className="text-xs px-2 py-1 rounded-lg bg-amber-100 text-amber-700 font-semibold"
          >
            Reset
          </button>
          <button onClick={() => setConfirming(null)} className="text-xs px-2 py-1 rounded-lg bg-[var(--surface-2)] text-[var(--text-muted)]">
            Cancel
          </button>
        </div>
      ) : confirming === 'remove' ? (
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => { onRemove(word.id); setConfirming(null); }}
            className="text-xs px-2 py-1 rounded-lg bg-red-100 text-red-700 font-semibold"
          >
            Remove
          </button>
          <button onClick={() => setConfirming(null)} className="text-xs px-2 py-1 rounded-lg bg-[var(--surface-2)] text-[var(--text-muted)]">
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => setConfirming('reset')}
            className="text-xs px-2 py-1 rounded-lg bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-amber-600"
            title="Reset to stage 0"
          >
            ↺
          </button>
          <button
            onClick={() => setConfirming('remove')}
            className="text-xs px-2 py-1 rounded-lg bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-red-500"
            title="Remove from deck"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
