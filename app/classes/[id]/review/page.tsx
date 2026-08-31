'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { displayXP } from '@/lib/storage';
import { recordClassStudyDay } from '@/lib/class-xp';
import { speak } from '@/lib/speech';
import {
  getClassDueWords, getClassSRSAll, advanceClassSRSWord, addClassHardWord,
  recordClassReviewEvent, stageLabel, stageColor, type ClassSRSEntry,
} from '@/lib/class-srs';
import { shuffleArray } from '@/lib/shuffleArray';

const TILE_COLORS = [
  { bg: '#e21b3c', shadow: '#a01328', shape: '▲' },
  { bg: '#1368ce', shadow: '#0d4fa0', shape: '◆' },
  { bg: '#d89e00', shadow: '#a07500', shape: '●' },
  { bg: '#26890c', shadow: '#1c6409', shape: '■' },
] as const;

// Anti-mash gates: with per-card persistence a student can otherwise clear the
// whole queue by rapidly tapping without reading anything, which pollutes their
// SRS scheduling (and, once review XP is gated on stage change, farms XP).
//   REVEAL_BEAT_MS      – the answer must be visible this long before the
//                         Not yet / Knew it buttons work. Applies to both the
//                         fallback (no-tiles) path and the MCQ path (after a
//                         tile is tapped) — in both the student self-grades.
//   OPTIONS_BEAT_MS     – MCQ path: the option tiles are dimmed and inert this
//                         long after the prompt is tapped, so the recall-first
//                         reveal can't be blown past with a queued tap.
//   CARD_LOCKOUT_MS     – input ignored this long after each grade so a
//                         queued/double tap can't fall through onto the next card.
const REVEAL_BEAT_MS = 800;
const OPTIONS_BEAT_MS = 450;
const CARD_LOCKOUT_MS = 350;

export default function ClassReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [queue,      setQueue]      = useState<ClassSRSEntry[]>([]);
  const [allPool,    setAllPool]    = useState<ClassSRSEntry[]>([]); // for choice generation
  const [index,      setIndex]      = useState(0);
  const [revealed,   setRevealed]   = useState(false);
  const [gradeUnlocked, setGradeUnlocked] = useState(false); // answer has been visible >= REVEAL_BEAT_MS
  const [cardLocked, setCardLocked] = useState(false);       // within CARD_LOCKOUT_MS of the last grade
  const [done,       setDone]       = useState(false);
  const [results,    setResults]    = useState<{ word: string; knew: boolean }[]>([]);
  const [autoPlay,   setAutoPlay]   = useState(true);
  const [isShuffled, setIsShuffled] = useState(false);
  const [tappedChoice, setTappedChoice] = useState<string | null>(null);
  const [optionsShown, setOptionsShown] = useState(false);    // MCQ: prompt tapped, option tiles revealed
  const [optionsUnlocked, setOptionsUnlocked] = useState(false); // MCQ: OPTIONS_BEAT_MS elapsed since reveal
  const [choices,    setChoices]    = useState<string[] | null>(null);
  const [userId,     setUserId]     = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [className,  setClassName]  = useState('');
  const [loading,    setLoading]    = useState(true);

  // Guards grade() against a double-tap re-entering with the same card before
  // React commits the index advance. Mirrors Flutter's _answering flag.
  const grading = useRef(false);
  // The pending REVEAL_BEAT_MS timer, cleared on card change so a beat armed
  // for a previous card can't unlock grading early on the next one.
  const beatTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // performance.now() when the current card's answer/options were revealed, for
  // the reveal->grade timing logged to class_review_events.
  const revealedAt = useRef<number | undefined>(undefined);

  // Resolve user + class name
  useEffect(() => {
    (async () => {
      try {
        const [{ data: { user } }, { data: cls }] = await Promise.all([
          supabase.auth.getUser(),
          supabase.from('classes').select('name').eq('id', id).single(),
        ]);
        setUserId(user?.id ?? null);
        setClassName((cls as { name: string } | null)?.name ?? 'Class');
        // No session → nothing to load; clear the spinner here since the
        // loadQueue effect below bails on a null userId.
        if (!user) setLoading(false);
      } finally {
        // Distinguishes "no session" from "still resolving" — without this,
        // an expired/missing session (userId stays null either way) left
        // the next effect's `if (!userId) return` guard never firing, so
        // loading never cleared and the page spun forever.
        setAuthChecked(true);
      }
    })();
  }, [id]);

  // Load due words + full pool. Also used by the "Redo" button — it re-fetches
  // whatever is still due rather than replaying the just-graded queue, since
  // grades are now persisted per-card (replaying would double-advance stages).
  const loadQueue = useCallback(async () => {
    if (!userId) return;
    try {
      const [due, all] = await Promise.all([
        getClassDueWords(userId, id),
        getClassSRSAll(userId, id),
      ]);
      setQueue(due);
      setAllPool(all);
      setIndex(0);
      setResults([]);
      setRevealed(false);
      setTappedChoice(null);
      setOptionsShown(false);
      setOptionsUnlocked(false);
      setDone(due.length === 0);
    } finally {
      setLoading(false);
    }
  }, [userId, id]);

  useEffect(() => {
    if (!authChecked || !id || !userId) return;
    void loadQueue();
  }, [authChecked, id, userId, loadQueue]);

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
    const wrong = shuffleArray([...pool]).slice(0, Math.min(3, pool.size));
    return shuffleArray([correct, ...wrong]);
  }, [allPool]);

  // New card: clear the answer + re-arm both gates, and hold input locked for
  // CARD_LOCKOUT_MS so a tap meant for the previous card can't land on this one.
  useEffect(() => {
    setTappedChoice(null);
    setRevealed(false);
    setGradeUnlocked(false);
    setOptionsShown(false);
    setOptionsUnlocked(false);
    setCardLocked(true);
    setChoices(buildChoices(index, queue));
    if (current && autoPlay) speak(current.word);
    clearTimeout(beatTimer.current);
    revealedAt.current = undefined;
    const t = setTimeout(() => setCardLocked(false), CARD_LOCKOUT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, autoPlay, buildChoices]);

  // Reveal the answer (fallback Reveal button / keyboard, or after an MCQ tile
  // is tapped) and start the beat that unlocks the Not yet / Knew it buttons.
  // The student always self-grades — the tile tap just shows whether they were
  // right, it doesn't decide the SRS outcome.
  const reveal = useCallback(() => {
    if (cardLocked || revealed) return;
    setRevealed(true);
    // In MCQ mode revealedAt is already stamped by showOptions (recall-first
    // gate); only the fallback path reaches here with it still unset.
    if (revealedAt.current === undefined) revealedAt.current = performance.now();
    clearTimeout(beatTimer.current);
    beatTimer.current = setTimeout(() => setGradeUnlocked(true), REVEAL_BEAT_MS);
  }, [cardLocked, revealed]);

  // MCQ recall gate: the student taps the prompt to reveal the option tiles,
  // having tried to recall the translation first. Tiles are dimmed and inert
  // for OPTIONS_BEAT_MS after this so a queued tap can't fall straight onto one.
  const showOptions = useCallback(() => {
    if (cardLocked || optionsShown) return;
    setOptionsShown(true);
    setOptionsUnlocked(false);
    revealedAt.current = performance.now();
    clearTimeout(beatTimer.current);
    beatTimer.current = setTimeout(() => setOptionsUnlocked(true), OPTIONS_BEAT_MS);
  }, [cardLocked, optionsShown]);

  const toggleShuffle = () => {
    const next = !isShuffled;
    setIsShuffled(next);
    setQueue(prev => next ? shuffleArray(prev) : [...prev]);
    setIndex(0); setResults([]); setRevealed(false); setTappedChoice(null);
    setGradeUnlocked(false); setCardLocked(false);
    setOptionsShown(false); setOptionsUnlocked(false);
  };

  const grade = useCallback((knew: boolean) => {
    if (!current || grading.current || cardLocked || !gradeUnlocked) return;
    grading.current = true;
    setTimeout(() => { grading.current = false; }, 100);

    // Persist this card's result immediately, fire-and-forget. The session no
    // longer batches grades to the end, so closing the tab / hitting Back /
    // navigating away mid-session can't lose already-answered cards. Every
    // write here is class-domain only (class_srs_states, class_members.class_xp,
    // class_study_days, class_hard_words) — nothing touches the personal XP
    // pool or streak. Mirrors Flutter's _recordAnswer in class_review_screen.dart.
    if (userId) {
      // advanceClassSRSWord awards the 2 XP for a correct answer itself, on the
      // server, only when the stage actually advances (migration 20260827) —
      // nothing here passes review XP to record_class_xp any more. .catch: the
      // wrapper already console.errors on failure.
      void advanceClassSRSWord(userId, id, current.word, knew).catch(() => {});
      void recordClassStudyDay(userId, id); // count the session as class activity (knew and miss alike)
      if (!knew) void addClassHardWord(userId, id, current.word);
      const responseMs = revealedAt.current == null ? null : Math.round(performance.now() - revealedAt.current);
      void recordClassReviewEvent(userId, id, current.word, knew, responseMs);
    }

    setResults(prev => [...prev, { word: current.word, knew }]);
    setTappedChoice(null);
    if (index + 1 >= queue.length) {
      setDone(true);
    } else {
      setIndex(i => i + 1);
    }
  }, [current, index, queue, userId, id, cardLocked, gradeUnlocked]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (!current) return;
      switch (e.key) {
        case ' ': case 'Enter': e.preventDefault(); if (choices === null) reveal(); else showOptions(); break;
        // Grade with j/k/arrows once the answer is visible: fallback path after
        // Reveal, MCQ path after a tile has been tapped.
        case 'ArrowRight': case 'k': case 'K': if ((choices === null || tappedChoice) && gradeUnlocked && !cardLocked) grade(true); break;
        case 'ArrowLeft':  case 'j': case 'J': if ((choices === null || tappedChoice) && gradeUnlocked && !cardLocked) grade(false); break;
        case 's': case 'S': speak(current.word); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [current, reveal, showOptions, gradeUnlocked, cardLocked, grade, choices, tappedChoice]);

  const handleChoiceTap = (choice: string) => {
    if (tappedChoice || !current || cardLocked || !optionsUnlocked) return;
    setTappedChoice(choice);
    reveal(); // shows the result + unlocks the grade buttons; the student self-grades
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
    const sessionXP = knewCount * 2; // matches the per-card award in grade()
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
            onClick={() => { setLoading(true); void loadQueue(); }}
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

  // Not yet / Knew it — the student's self-grade. Shown on the fallback path
  // after Reveal, and on the MCQ path once a tile has been tapped. Disabled
  // until the reveal beat elapses so a queued tap can't fall straight onto one.
  const gradeButtons = (
    <div className="flex gap-2 animate-slide-up">
      <button onClick={() => grade(false)} disabled={!gradeUnlocked} className="flex-1 py-4 rounded-xl border-2 border-[var(--danger)] text-[var(--danger)] font-bold text-sm hover:bg-red-50 transition-colors flex flex-col items-center gap-1 disabled:opacity-40 disabled:hover:bg-transparent">
        <span>✗</span><span className="text-xs font-normal">Not yet <span className="opacity-50">J</span></span>
      </button>
      <button onClick={() => grade(true)} disabled={!gradeUnlocked} className="flex-1 py-4 rounded-xl border-2 border-[var(--success)] text-[var(--success)] font-bold text-sm hover:bg-green-50 transition-colors flex flex-col items-center gap-1 disabled:opacity-40 disabled:hover:bg-transparent">
        <span>✓</span><span className="text-xs font-normal">Knew it <span className="opacity-50">K</span></span>
      </button>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <button
          onClick={() => router.push(`/classes/${id}/words`)}
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
        {/* Stage badge + struggling hint */}
        <div className="flex justify-between items-center">
          {current.fail_streak >= 2 ? (
            <div className="badge text-xs" style={{ background: '#f59e0b20', color: '#f59e0b' }}>
              Keeps tripping you up
            </div>
          ) : <span />}
          <div
            className="badge text-xs"
            style={{ background: `${stageColor(stage)}20`, color: stageColor(stage) }}
          >
            {stageLabel(stage)}
          </div>
        </div>

        {/* Word card — in MCQ mode the whole card is the recall-first tap target */}
        <div
          className={`card animate-slide-up flex flex-col gap-3${choices !== null && !optionsShown && !cardLocked ? ' cursor-pointer' : ''}`}
          style={{ minHeight: choices !== null ? 'auto' : 280 }}
          onClick={choices !== null && !optionsShown && !cardLocked ? showOptions : undefined}
          role={choices !== null && !optionsShown ? 'button' : undefined}
        >
          <div className="flex items-center justify-between">
            <span className="badge text-xs">Class word</span>
            <button
              onClick={(e) => { e.stopPropagation(); speak(current.word); }}
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
            <button onClick={() => reveal()} disabled={cardLocked} className="mt-4 btn-secondary w-full disabled:opacity-40">
              Reveal
            </button>
          ) : !optionsShown ? (
            <p className="mt-3 text-sm text-[var(--text-muted)] flex items-center gap-1.5">
              <span aria-hidden>👆</span> Tap to see options
            </p>
          ) : null}
        </div>

        {/* Quiz mode tiles */}
        {choices !== null && optionsShown ? (
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
                    disabled={answered || !optionsUnlocked}
                    className={`relative rounded-2xl p-4 flex flex-col gap-2 min-h-[100px] transition-all duration-200 text-left active:translate-y-1${isLast ? ' col-span-2' : ''}`}
                    style={{ backgroundColor: bgColor, boxShadow: `0 4px 0 ${shadowColor}`, opacity: !answered && !optionsUnlocked ? 0.5 : opacity }}
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
              <>
                <p className="text-center text-xs text-[var(--text-muted)] animate-fade-in">
                  {tappedChoice === current.translation ? 'Correct — nice' : `Answer: ${current.translation}`}
                </p>
                {gradeButtons}
              </>
            )}
          </div>
        ) : (
          revealed && gradeButtons
        )}
      </div>
    </div>
  );
}
