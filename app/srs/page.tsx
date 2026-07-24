'use client';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { speak, speakText } from '@/lib/speech';
import {
  getDueWords, markIntervalDone, addXP, displayXP, recordStudySession, recordReviewDay,
  unlockAchievement, getSRSWords, getLearnedWords, removeSRSWord, getReviewLog,
} from '@/lib/storage';
import { stageColor } from '@/lib/srs';
import { checkAchievements } from '@/lib/gamification';
import { pushAllCurrentUser } from '@/lib/web-sync';
import { REVIEW_XP, SRS_INTERVALS } from '@/lib/types';
import type { DueSRSWord, SRSWord } from '@/lib/types';
import Link from 'next/link';
import { useTranslation } from '@/lib/useTranslation';

const TILE_COLORS = [
  { bg: '#e21b3c', shadow: '#a01328', shape: '▲' },
  { bg: '#1368ce', shadow: '#0d4fa0', shape: '◆' },
  { bg: '#d89e00', shadow: '#a07500', shape: '●' },
  { bg: '#26890c', shadow: '#1c6409', shape: '■' },
] as const;

export default function SRSReviewPage() {
  const router = useRouter();
  const t = useTranslation();
  const { pushAchievement, setPendingLevelUp } = useAppStore();
  const collections = useAppStore(s => s.collections);
  const [queue, setQueue] = useState<DueSRSWord[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<{ id: string; grade: 'knew' | 'notYet' }[]>([]);
  const [done, setDone] = useState(false);
  const [sessionXP, setSessionXP] = useState(0);
  const [managing, setManaging] = useState(false);
  const [allWords, setAllWords] = useState<SRSWord[]>([]);
  const [autoPlay, setAutoPlay] = useState(true);
  const [tappedChoice, setTappedChoice] = useState<string | null>(null);
  const [choices, setChoices] = useState<string[] | null>(null);
  const grading = useRef(false);
  const gradesApplied = useRef(false);
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadWords = useCallback(() => {
    const due = getDueWords();
    const shuffled = [...due].sort(() => Math.random() - 0.5);
    setQueue(shuffled);
    if (shuffled.length === 0) setDone(true);
    setAllWords(getSRSWords());
  }, []);

  useEffect(() => { loadWords(); }, [loadWords]);

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

  const openInUnitHref = useMemo(() => {
    if (!current || !current.collectionName || current.collectionName === 'my-words') return null;
    const col = collections.find(c => c.name === current.collectionName);
    if (!col) return `/learn?collection=${encodeURIComponent(current.collectionName)}&day=${current.dayNumber}`;
    const day = col.days.find(d => d.dayNumber === current.dayNumber);
    const wi = day ? day.words.findIndex(w => w.word === current.word) : -1;
    return `/learn?collection=${encodeURIComponent(current.collectionName)}&day=${current.dayNumber}&startIndex=${wi >= 0 ? wi : 0}`;
  }, [current, collections]);

  const buildChoices = useCallback((idx: number, q: DueSRSWord[]): string[] | null => {
    if (!q[idx]) return null;
    const correct = q[idx].translation;
    const pool = new Set<string>();
    q.forEach((w, i) => { if (i !== idx && w.translation !== correct) pool.add(w.translation); });
    if (pool.size < 3) {
      for (const lw of getLearnedWords()) {
        if (lw.translation !== correct) pool.add(lw.translation);
        if (pool.size >= 3) break;
      }
    }
    if (pool.size < 2) return null;
    const wrong = [...pool].sort(() => Math.random() - 0.5).slice(0, Math.min(3, pool.size));
    return [correct, ...wrong].sort(() => Math.random() - 0.5);
  }, []);

  useEffect(() => {
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    setTappedChoice(null);
    setRevealed(false);
    setChoices(buildChoices(index, queue));
    if (current && autoPlay) { current.language ? speakText(current.word, current.language) : speak(current.word); }
  }, [current, autoPlay, buildChoices]); // eslint-disable-line react-hooks/exhaustive-deps

  // At session end: mark each learnedAt date's interval as done, award XP
  const applyGrades = useCallback((finalResults: { id: string; grade: 'knew' | 'notYet' }[]) => {
    if (gradesApplied.current) return;
    gradesApplied.current = true;
    if (finalResults.length === 0) return;

    // Only mark interval done for words the user knew — matches Flutter failSRSWord no-op
    for (let i = 0; i < finalResults.length; i++) {
      if (finalResults[i].grade === 'knew') {
        markIntervalDone(queue[i].id, queue[i].dueInterval);
      }
    }

    const knewCount = finalResults.filter(r => r.grade === 'knew').length;
    const xpTotal = finalResults.reduce((sum, r, i) =>
      r.grade === 'knew' ? sum + (REVIEW_XP[queue[i].dueInterval] ?? 2) : sum, 0);
    const { leveledUp, newLevel, newXp } = addXP(xpTotal, 'SRS Review');
    if (leveledUp) setPendingLevelUp({ level: newLevel, xp: newXp });
    setSessionXP(xpTotal);

    unlockAchievement('srs_first');
    recordStudySession();
    recordReviewDay();
    const newAchievements = checkAchievements();
    newAchievements.forEach(pushAchievement);
    pushAllCurrentUser();
  }, [queue, pushAchievement, setPendingLevelUp]);

  const grade = useCallback((g: 'knew' | 'notYet') => {
    if (!current || grading.current) return;
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    grading.current = true;
    setTimeout(() => { grading.current = false; }, 100);
    const newResults = [...results, { id: current.id, grade: g }];
    setResults(newResults);
    setTappedChoice(null);
    if (index + 1 >= queue.length) {
      applyGrades(newResults);
      setDone(true);
    } else {
      setIndex(i => i + 1);
    }
  }, [current, index, queue, results, applyGrades]);

  const goBack = useCallback(() => {
    if (index === 0) return;
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    grading.current = false;
    setTappedChoice(null);
    setIndex(i => i - 1);
    setResults(r => r.slice(0, -1));
    setRevealed(false);
  }, [index]);

  const handleChoiceTap = useCallback((choice: string) => {
    if (tappedChoice || !current) return;
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    setTappedChoice(choice);
    setRevealed(true);
    if (choice === current.translation) {
      autoAdvanceTimer.current = setTimeout(() => grade('knew'), 1500);
    }
  }, [tappedChoice, current, grade]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (managing) { if (e.key === 'Escape') setManaging(false); return; }
      if (!current) return;
      switch (e.key) {
        case ' ': case 'Enter': e.preventDefault(); if (!revealed) setRevealed(true); break;
        case 'ArrowRight': case 'k': case 'K': if (revealed) grade('knew'); break;
        case 'ArrowLeft': case 'j': case 'J': if (revealed) grade('notYet'); break;
        case 's': case 'S': current.language ? speakText(current.word, current.language) : speak(current.word); break;
        case 'Backspace': case 'b': case 'B': e.preventDefault(); goBack(); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [current, revealed, managing, grade, goBack]);

  const handleRemove = (id: string) => {
    removeSRSWord(id);
    setAllWords(prev => prev.filter(w => w.id !== id));
    setQueue(prev => prev.filter(w => w.id !== id));
  };

  // ── Manage deck view ────────────────────────────────────────────────────────
  if (managing) {
    const log = getReviewLog();
    const graduated = allWords.filter(w => (log[w.id] ?? []).length >= SRS_INTERVALS.length);
    const learning  = allWords.filter(w => (log[w.id] ?? []).length < SRS_INTERVALS.length);

    return (
      <div className="flex flex-col min-h-screen">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <button onClick={() => setManaging(false)} className="btn-icon" aria-label="Go back">←</button>
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
                  In Progress · {learning.length}
                </h2>
                <div className="space-y-2">
                  {learning.map(w => (
                    <WordManageRow key={w.id} word={w} completedCount={(log[w.id] ?? []).length} onRemove={handleRemove} />
                  ))}
                </div>
              </section>
            )}
            {graduated.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">
                  Graduated · {graduated.length}
                </h2>
                <div className="space-y-2">
                  {graduated.map(w => (
                    <WordManageRow key={w.id} word={w} completedCount={(log[w.id] ?? []).length} onRemove={handleRemove} />
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
    const knewCount   = results.filter(r => r.grade === 'knew').length;
    const notYetCount = results.filter(r => r.grade === 'notYet').length;
    const score = Math.round((knewCount / results.length) * 100);
    return (
      <div className="p-6 text-center flex flex-col items-center justify-center min-h-screen animate-fade-in">
        <div className="text-6xl mb-4">{score >= 80 ? '🧠' : '💪'}</div>
        <h2 className="text-2xl font-bold mb-2">{t.srs.reviewComplete}</h2>
        <p className="text-[var(--text-muted)] mb-6">{knewCount}/{results.length} knew · +{displayXP(sessionXP)} XP</p>
        <div className="grid grid-cols-3 gap-2 w-full mb-6">
          <div className="card text-center"><div className="text-xl font-bold text-[var(--success)]">{knewCount}</div><div className="text-xs text-[var(--text-muted)]">{t.srs.correct}</div></div>
          <div className="card text-center"><div className="text-xl font-bold text-[var(--danger)]">{notYetCount}</div><div className="text-xs text-[var(--text-muted)]">{t.srs.incorrect}</div></div>
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
        <button onClick={() => { applyGrades(results); router.back(); }} className="btn-icon" aria-label="Go back">✕</button>
        <div className="text-center">
          <div className="font-semibold text-sm">{t.srs.title}</div>
          <div className="text-xs text-[var(--text-muted)]">{index + 1} / {queue.length}</div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setAutoPlay(p => !p)}
            className="btn-icon text-base"
            aria-label={autoPlay ? 'Auto-play on' : 'Auto-play off'}
          >
            {autoPlay ? '🔊' : '🔇'}
          </button>
          <button
            onClick={() => { setAllWords(getSRSWords()); setManaging(true); }}
            className="btn-icon text-sm"
            aria-label="Manage deck"
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="px-4">
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="flex-1 p-4 flex flex-col gap-4">
        {/* Back button + interval badge */}
        <div className="flex items-center justify-between">
          <button
            onClick={goBack}
            disabled={index === 0}
            className="btn-icon text-sm disabled:opacity-30"
            aria-label="Previous word"
          >
            ←
          </button>
          <div className="badge text-xs" style={{ background: '#4338ca20', color: '#4338ca' }}>
            Day +{current.dueInterval} review
          </div>
        </div>

        {/* Word card */}
        <div className="card animate-slide-up flex flex-col gap-3" style={{ minHeight: choices !== null ? 'auto' : 280 }}>
          <div className="flex items-center justify-between">
            <span className="badge text-xs">{current.topic}</span>
            <button
              onClick={() => current.language ? speakText(current.word, current.language) : speak(current.word)}
              className="w-8 h-8 rounded-full bg-[var(--primary-bg)] flex items-center justify-center hover:bg-[var(--primary)] hover:text-white transition-colors"
              aria-label="Listen"
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
              {[current.example1, current.example2, current.example3].filter(Boolean).map((ex, i) => (
                <div key={i} className="bg-[var(--surface-2)] rounded-xl p-3">
                  <p className="text-xs italic text-[var(--text-muted)]">"{ex}"</p>
                </div>
              ))}
              <div className="flex items-center justify-between gap-2">
                {openInUnitHref && (
                  <Link href={openInUnitHref} className="text-xs text-[var(--primary)] font-medium hover:underline">
                    Open in unit →
                  </Link>
                )}
                {current.collectionName !== 'my-words' && (
                  <Link
                    href={`/word/${encodeURIComponent(current.word)}`}
                    className="text-xs text-[var(--primary)] font-medium hover:underline ml-auto"
                  >
                    {t.srs.fullDetails}
                  </Link>
                )}
              </div>
            </div>
          ) : choices === null ? (
            <button onClick={() => setRevealed(true)} className="mt-4 btn-secondary w-full">
              {t.srs.reveal}
            </button>
          ) : null}
        </div>

        {/* Quiz mode: Kahoot-style tiles */}
        {choices !== null ? (
          <div className="animate-slide-up space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {choices.map((choice, i) => {
                const tile = TILE_COLORS[i % 4];
                const answered = tappedChoice !== null;
                const isCorrect = choice === current.translation;
                const isTapped = choice === tappedChoice;
                const isLast = choices.length === 3 && i === 2;
                let bgColor = tile.bg;
                let shadowColor = tile.shadow;
                let opacity = 1;
                if (answered) {
                  if (isCorrect) { bgColor = '#26890c'; shadowColor = '#1c6409'; }
                  else if (isTapped) { bgColor = '#e21b3c'; shadowColor = '#a01328'; }
                  else { opacity = 0.35; }
                }
                return (
                  <button
                    key={choice}
                    onClick={() => handleChoiceTap(choice)}
                    disabled={answered}
                    className={`relative rounded-2xl p-4 flex flex-col gap-2 min-h-[100px] transition-all duration-200 text-left active:translate-y-1${isLast ? ' col-span-2' : ''}`}
                    style={{ backgroundColor: bgColor, boxShadow: `0 4px 0 ${shadowColor}`, opacity }}
                  >
                    <span className="text-xl text-white/70 leading-none">{tile.shape}</span>
                    <span className="text-white font-bold text-sm leading-snug" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>{choice}</span>
                    {answered && isCorrect && <span className="absolute top-3 right-3 text-white text-lg font-black">✓</span>}
                    {answered && isTapped && !isCorrect && <span className="absolute top-3 right-3 text-white text-lg font-black">✗</span>}
                  </button>
                );
              })}
            </div>
            {tappedChoice && tappedChoice !== current.translation && (
              <div className="flex gap-2">
                <button onClick={() => grade('notYet')} className="flex-1 py-3 rounded-xl border-2 border-[var(--danger)] text-[var(--danger)] font-bold text-sm hover:bg-red-50 transition-colors">
                  {t.srs.notYet}
                </button>
              </div>
            )}
          </div>
        ) : (
          revealed && (
            <div className="flex gap-2 animate-slide-up">
              <button onClick={() => grade('notYet')} className="flex-1 py-4 rounded-xl border-2 border-[var(--danger)] text-[var(--danger)] font-bold text-sm hover:bg-red-50 transition-colors flex flex-col items-center gap-1">
                <span>✗</span><span className="text-xs font-normal">{t.srs.notYet}</span>
              </button>
              <button onClick={() => grade('knew')} className="flex-1 py-4 rounded-xl border-2 border-[var(--success)] text-[var(--success)] font-bold text-sm hover:bg-green-50 transition-colors flex flex-col items-center gap-1">
                <span>✓</span><span className="text-xs font-normal">{t.srs.knewIt}</span>
              </button>
            </div>
          )
        )}

        {/* Info bar */}
        <div className="card p-3 flex justify-between text-xs text-[var(--text-muted)]">
          <span>{t.srs.collection} {current.collectionName}</span>
          <span>Interval: +{current.dueInterval}d</span>
        </div>
      </div>
    </div>
  );
}

// ── Word row in manage view ───────────────────────────────────────────────────
function WordManageRow({
  word, completedCount, onRemove,
}: {
  word: SRSWord;
  completedCount: number;
  onRemove: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const graduated = completedCount >= SRS_INTERVALS.length;

  return (
    <div className="card flex items-center gap-3 py-3">
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[var(--text)] truncate">{word.word}</p>
        <p className="text-xs text-[var(--text-muted)] truncate">{word.translation}</p>
      </div>
      <span
        className="badge text-xs shrink-0"
        style={{ background: `${stageColor(completedCount)}20`, color: stageColor(completedCount) }}
      >
        {graduated ? 'Graduated' : `${completedCount}/${SRS_INTERVALS.length} done`}
      </span>

      {confirming ? (
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => { onRemove(word.id); setConfirming(false); }}
            className="text-xs px-2 py-1 rounded-lg bg-red-100 text-red-700 font-semibold"
          >
            Remove
          </button>
          <button onClick={() => setConfirming(false)} className="text-xs px-2 py-1 rounded-lg bg-[var(--surface-2)] text-[var(--text-muted)]">
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          className="text-xs px-2 py-1 rounded-lg bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-red-500 shrink-0"
          aria-label="Remove from deck"
        >
          ✕
        </button>
      )}
    </div>
  );
}
