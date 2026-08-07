'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { displayXP, recordStudySession } from '@/lib/storage';
import { recordClassXP } from '@/lib/class-xp';
import { speak } from '@/lib/speech';
import {
  getClassDueWords, getClassSRSAll, advanceClassSRSWord,
  stageLabel, stageColor, type ClassSRSEntry,
} from '@/lib/class-srs';

const TILE_COLORS = [
  { bg: '#e21b3c', shadow: '#a01328', shape: '▲' },
  { bg: '#1368ce', shadow: '#0d4fa0', shape: '◆' },
  { bg: '#d89e00', shadow: '#a07500', shape: '●' },
  { bg: '#26890c', shadow: '#1c6409', shape: '■' },
] as const;

export default function ClassReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [queue,      setQueue]      = useState<ClassSRSEntry[]>([]);
  const [allPool,    setAllPool]    = useState<ClassSRSEntry[]>([]); // for choice generation
  const [index,      setIndex]      = useState(0);
  const [revealed,   setRevealed]   = useState(false);
  const [done,       setDone]       = useState(false);
  const [results,    setResults]    = useState<{ word: string; knew: boolean }[]>([]);
  const [sessionXP,  setSessionXP]  = useState(0);
  const [autoPlay,   setAutoPlay]   = useState(true);
  const [isShuffled, setIsShuffled] = useState(false);
  const [tappedChoice, setTappedChoice] = useState<string | null>(null);
  const [choices,    setChoices]    = useState<string[] | null>(null);
  const [userId,     setUserId]     = useState<string | null>(null);
  const [className,  setClassName]  = useState('');
  const [loading,    setLoading]    = useState(true);

  const grading        = useRef(false);
  const gradesApplied  = useRef(false);

  // Resolve user + class name
  useEffect(() => {
    (async () => {
      const [{ data: { user } }, { data: cls }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('classes').select('name').eq('id', id).single(),
      ]);
      setUserId(user?.id ?? null);
      setClassName((cls as { name: string } | null)?.name ?? 'Class');
    })();
  }, [id]);

  // Load due words + full pool once userId is known
  useEffect(() => {
    if (!userId || !id) return;
    (async () => {
      const [due, all] = await Promise.all([
        getClassDueWords(userId, id),
        getClassSRSAll(userId, id),
      ]);
      setQueue(due);
      setAllPool(all);
      setLoading(false);
      if (due.length === 0) setDone(true);
    })();
  }, [userId, id]);

  const current = queue[index];

  const buildChoices = useCallback((idx: number, q: ClassSRSEntry[]): string[] | null => {
    if (!q[idx]) return null;
    const correct = q[idx].translation;
    const pool = new Set<string>();
    // Other due words first
    q.forEach((w, i) => { if (i !== idx && w.translation !== correct) pool.add(w.translation); });
    // Fill from full class pool
    for (const e of allPool) {
      if (pool.size >= 10) break;
      if (e.translation !== correct) pool.add(e.translation);
    }
    if (pool.size < 2) return null;
    const wrong = [...pool].sort(() => Math.random() - 0.5).slice(0, Math.min(3, pool.size));
    return [correct, ...wrong].sort(() => Math.random() - 0.5);
  }, [allPool]);

  useEffect(() => {
    setTappedChoice(null);
    setRevealed(false);
    setChoices(buildChoices(index, queue));
    if (current && autoPlay) speak(current.word);
  }, [current, autoPlay, buildChoices]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleShuffle = () => {
    const next = !isShuffled;
    setIsShuffled(next);
    setQueue(prev => next ? [...prev].sort(() => Math.random() - 0.5) : [...prev]);
    setIndex(0); setResults([]); setRevealed(false); setTappedChoice(null);
  };

  const applyGrades = useCallback(async (finalResults: { word: string; knew: boolean }[]) => {
    if (gradesApplied.current || !userId) return;
    gradesApplied.current = true;
    if (finalResults.length === 0) return;
    // Update Supabase for each graded word
    await Promise.all(finalResults.map(r => advanceClassSRSWord(userId, id, r.word, r.knew)));
    const knewCount = finalResults.filter(r => r.knew).length;
    const xp = knewCount * 2; // 2 XP per correct review (matches personal SRS rate)
    await recordClassXP(userId, id, xp, 'SRS Review'); // class XP is isolated from the app-wide pool — no level-up here
    setSessionXP(xp);
    recordStudySession();
  }, [userId, id]);

  const grade = useCallback((knew: boolean) => {
    if (!current || grading.current) return;
    grading.current = true;
    setTimeout(() => { grading.current = false; }, 100);
    const newResults = [...results, { word: current.word, knew }];
    setResults(newResults);
    setTappedChoice(null);
    if (index + 1 >= queue.length) {
      void applyGrades(newResults);
      setDone(true);
    } else {
      setIndex(i => i + 1);
    }
  }, [current, index, queue, results, applyGrades]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (!current) return;
      switch (e.key) {
        case ' ': case 'Enter': e.preventDefault(); if (!revealed) setRevealed(true); break;
        case 'ArrowRight': case 'k': case 'K': if (revealed) grade(true); break;
        case 'ArrowLeft':  case 'j': case 'J': if (revealed) grade(false); break;
        case 's': case 'S': speak(current.word); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [current, revealed, grade]);

  const handleChoiceTap = (choice: string) => {
    if (tappedChoice || !current) return;
    setTappedChoice(choice);
    setRevealed(true);
  };

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-4xl animate-bounce">🧠</div>
      </div>
    );
  }

  // ── No due words ─────────────────────────────────────────────────────────────
  if (done && queue.length === 0) {
    return (
      <div className="p-6 text-center flex flex-col items-center justify-center min-h-screen animate-fade-in">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold mb-2">All caught up!</h2>
        <p className="text-[var(--text-muted)] mb-6">No SRS words due today for this class.</p>
        <button onClick={() => router.push(`/classes/${id}/words`)} className="btn-primary">
          Back to class →
        </button>
      </div>
    );
  }

  // ── Session done ─────────────────────────────────────────────────────────────
  if (done) {
    const knewCount   = results.filter(r => r.knew).length;
    const notYetCount = results.filter(r => !r.knew).length;
    const score = Math.round((knewCount / results.length) * 100);
    return (
      <div className="p-6 text-center flex flex-col items-center justify-center min-h-screen animate-fade-in">
        <div className="text-6xl mb-4">{score >= 80 ? '🧠' : '💪'}</div>
        <h2 className="text-2xl font-bold mb-2">Review complete</h2>
        <p className="text-[var(--text-muted)] mb-6">{knewCount}/{results.length} knew · +{displayXP(sessionXP)} XP</p>
        <div className="grid grid-cols-3 gap-2 w-full mb-6">
          <div className="card text-center"><div className="text-xl font-bold text-[var(--success)]">{knewCount}</div><div className="text-xs text-[var(--text-muted)]">Correct</div></div>
          <div className="card text-center"><div className="text-xl font-bold text-[var(--danger)]">{notYetCount}</div><div className="text-xs text-[var(--text-muted)]">Not yet</div></div>
          <div className="card text-center"><div className="text-xl font-bold text-[var(--primary)]">{score}%</div><div className="text-xs text-[var(--text-muted)]">Score</div></div>
        </div>
        <div className="flex gap-3 w-full">
          <button
            onClick={() => { gradesApplied.current = false; setIndex(0); setRevealed(false); setResults([]); setDone(false); }}
            className="btn-secondary flex-1"
          >Redo</button>
          <button onClick={() => router.push(`/classes/${id}/words`)} className="btn-primary flex-1">
            Back to class
          </button>
        </div>
      </div>
    );
  }

  if (!current) return null;

  const progress = ((index + 1) / queue.length) * 100;
  const stage = current.stage;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <button
          onClick={() => { void applyGrades(results); router.push(`/classes/${id}/words`); }}
          className="btn-icon" aria-label="Exit review"
        >✕</button>
        <div className="text-center">
          <div className="font-semibold text-sm">SRS Review · {className}</div>
          <div className="text-xs text-[var(--text-muted)]">{index + 1} / {queue.length}</div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleShuffle}
            className={`btn-icon text-base ${isShuffled ? 'text-[var(--primary)]' : 'opacity-40'}`}
            title={isShuffled ? 'Shuffled' : 'In order'}
          >🔀</button>
          <button
            onClick={() => setAutoPlay(p => !p)}
            className="btn-icon text-base"
            title={autoPlay ? 'Auto-play on' : 'Auto-play off'}
          >{autoPlay ? '🔊' : '🔇'}</button>
        </div>
      </div>

      {/* Progress bar */}
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
            style={{ background: `${stageColor(stage)}20`, color: stageColor(stage) }}
          >
            {stageLabel(stage)}
          </div>
        </div>

        {/* Word card */}
        <div className="card animate-slide-up flex flex-col gap-3" style={{ minHeight: choices !== null ? 'auto' : 280 }}>
          <div className="flex items-center justify-between">
            <span className="badge text-xs">Class word</span>
            <button
              onClick={() => speak(current.word)}
              className="w-8 h-8 rounded-full bg-[var(--primary-bg)] flex items-center justify-center hover:bg-[var(--primary)] hover:text-white transition-colors"
              aria-label="Listen"
            >🔊</button>
          </div>

          <h2 className="text-3xl font-bold text-[var(--text)]">{current.word}</h2>

          {revealed ? (
            <div className="space-y-3 animate-fade-in">
              <div className="bg-[var(--primary-bg)] rounded-xl p-3">
                <p className="text-xs font-semibold text-[var(--primary)] mb-1">Translation</p>
                <p className="text-lg font-semibold text-[var(--primary)]">{current.translation}</p>
              </div>
            </div>
          ) : choices === null ? (
            <button onClick={() => setRevealed(true)} className="mt-4 btn-secondary w-full">
              Reveal
            </button>
          ) : null}
        </div>

        {/* Quiz mode tiles */}
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
            {tappedChoice && (
              <div className="flex gap-2 animate-slide-up">
                <button onClick={() => grade(false)} className="flex-1 py-3 rounded-xl border-2 border-[var(--danger)] text-[var(--danger)] font-bold text-sm hover:bg-red-50 transition-colors">
                  Not yet
                </button>
                <button onClick={() => grade(true)} className="flex-1 py-3 rounded-xl border-2 border-[var(--success)] text-[var(--success)] font-bold text-sm hover:bg-green-50 transition-colors">
                  Knew it ✓
                </button>
              </div>
            )}
          </div>
        ) : (
          revealed && (
            <div className="flex gap-2 animate-slide-up">
              <button onClick={() => grade(false)} className="flex-1 py-4 rounded-xl border-2 border-[var(--danger)] text-[var(--danger)] font-bold text-sm hover:bg-red-50 transition-colors flex flex-col items-center gap-1">
                <span>✗</span><span className="text-xs font-normal">Not yet</span>
              </button>
              <button onClick={() => grade(true)} className="flex-1 py-4 rounded-xl border-2 border-[var(--success)] text-[var(--success)] font-bold text-sm hover:bg-green-50 transition-colors flex flex-col items-center gap-1">
                <span>✓</span><span className="text-xs font-normal">Knew it</span>
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}
