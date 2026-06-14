'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { speak } from '@/lib/speech';
import { getDueWords, updateSRSWord, addXP, recordStudySession, unlockAchievement } from '@/lib/storage';
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

  useEffect(() => {
    const due = getDueWords();
    // Shuffle
    const shuffled = [...due].sort(() => Math.random() - 0.5);
    setQueue(shuffled);
    if (shuffled.length === 0) setDone(true);
  }, []);

  const current = queue[index];

  useEffect(() => {
    setRevealed(false);
    if (current) speak(current.word);
  }, [current]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (!current) return;
      switch (e.key) {
        case ' ': case 'Enter': e.preventDefault(); if (!revealed) setRevealed(true); break;
        case 'ArrowRight': case 'k': case 'K': if (revealed) grade(true); break;
        case 'ArrowLeft': case 'j': case 'J': if (revealed) grade(false); break;
        case 's': case 'S': speak(current.word); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [current, revealed]);

  const grade = useCallback((success: boolean) => {
    if (!current) return;
    updateSRSWord(current.id, success);
    if (success) {
      const { leveledUp, newLevel, newXp } = addXP(XP_PER_SRS);
      if (leveledUp) setPendingLevelUp({ level: newLevel, xp: newXp });
      unlockAchievement('srs_first');
    }
    recordStudySession();
    setResults(r => [...r, { id: current.id, success }]);
    const newAchievements = checkAchievements();
    newAchievements.forEach(pushAchievement);

    if (index + 1 >= queue.length) {
      setDone(true);
    } else {
      setIndex(i => i + 1);
    }
  }, [current, index, queue, pushAchievement, setPendingLevelUp]);

  if (done && queue.length === 0) {
    return (
      <div className="p-6 text-center flex flex-col items-center justify-center min-h-screen animate-fade-in">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold mb-2">{t.srs.allCaughtUp}</h2>
        <p className="text-[var(--text-muted)] mb-6">{t.srs.noDueWords}</p>
        <Link href="/" className="btn-primary">{t.srs.goHome}</Link>
      </div>
    );
  }

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
        <div className="flex gap-3 w-full">
          <button onClick={() => { setIndex(0); setRevealed(false); setResults([]); setDone(false); }} className="btn-secondary flex-1">{t.common.redo}</button>
          <Link href="/" className="btn-primary flex-1 text-center">{t.srs.goHome}</Link>
        </div>
      </div>
    );
  }

  if (!current) return null;

  const progress = ((index + 1) / queue.length) * 100;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-[var(--surface-2)] flex items-center justify-center">←</button>
        <div className="text-center">
          <div className="font-semibold text-sm">{t.srs.title}</div>
          <div className="text-xs text-[var(--text-muted)]">{index + 1} / {queue.length}</div>
        </div>
        <div
          className="badge text-xs"
          style={{ background: `${stageColor(current.reviewStage)}20`, color: stageColor(current.reviewStage) }}
        >
          {stageLabel(current.reviewStage)}
        </div>
      </div>

      {/* Progress */}
      <div className="px-4">
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="flex-1 p-4 flex flex-col gap-4">
        {/* Word card */}
        <div className="card animate-slide-up flex flex-col gap-3" style={{ minHeight: 280 }}>
          <div className="flex items-center justify-between">
            <span className="badge text-xs">{current.topic}</span>
            <button
              onClick={() => speak(current.word)}
              className="w-8 h-8 rounded-full bg-[var(--primary-bg)] flex items-center justify-center hover:bg-[var(--primary)] hover:text-white transition-colors"
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
              <Link
                href={`/word/${encodeURIComponent(current.word)}`}
                className="text-xs text-[var(--primary)] font-medium hover:underline text-right block"
              >
                {t.srs.fullDetails}
              </Link>
            </div>
          ) : (
            <button
              onClick={() => setRevealed(true)}
              className="mt-4 btn-secondary w-full"
            >
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
