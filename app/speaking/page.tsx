'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { speak } from '@/lib/speech';
import { part1Pool, part2Cards, part3Pool } from '@/lib/speaking-data';
import type { SpeakingQuestion, SpeakingCueCard } from '@/lib/speaking-data';

type Part = 1 | 2 | 3;

const PART_INFO: Record<Part, { label: string; sub: string; icon: string; color: string; light: string; dark: string; count: number }> = {
  1: { label: 'Part 1', sub: 'Introduction & Interview', icon: '💬', color: '#6C63FF', light: '#8B83FF', dark: '#4338CA', count: part1Pool.length },
  2: { label: 'Part 2', sub: 'The Long Turn (cue card)', icon: '🎴', color: '#FF6584', light: '#FF8FA3', dark: '#C2410C', count: part2Cards.length },
  3: { label: 'Part 3', sub: 'Discussion', icon: '🧠', color: '#2ECC71', light: '#34D399', dark: '#0F6634', count: part3Pool.length },
};

const SPIN_TICKS = 14;
const PREP_SECONDS = 60;
const SPEAK_SECONDS = 120;

function randomFrom<T>(arr: T[], excludeIndex?: number): { item: T; index: number } {
  let index = Math.floor(Math.random() * arr.length);
  if (arr.length > 1 && index === excludeIndex) {
    index = (index + 1) % arr.length;
  }
  return { item: arr[index], index };
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// ── Sound (Web Audio, no files) ───────────────────────────────────────────────

let audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioCtx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

// Soft slot-machine "tick" — pitch rises slightly as the spin decelerates.
function playTick(pitch: number) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(420 * pitch, ctx.currentTime);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.09, ctx.currentTime + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.06);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.07);
  } catch {}
}

// Bright ascending chime for when the spin lands on the final question.
function playReveal() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const freqs = [523.25, 659.25, 783.99]; // C5, E5, G5
    freqs.forEach((freq, i) => {
      const start = ctx.currentTime + i * 0.09;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.2, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.4);
      osc.start(start);
      osc.stop(start + 0.42);
    });
  } catch {}
}

const SESSION_KEY = 'lexivo_speaking_session';

export default function SpeakingPage() {
  const router = useRouter();
  const [part, setPart] = useState<Part | null>(null);

  const [spinning, setSpinning] = useState(false);
  const [flickerText, setFlickerText] = useState('');
  const [flickerTopic, setFlickerTopic] = useState('');

  const [question, setQuestion] = useState<SpeakingQuestion | null>(null);
  const [card, setCard] = useState<SpeakingCueCard | null>(null);
  const lastIndexRef = useRef<number | undefined>(undefined);
  const skipNextPersistRef = useRef(true);

  // Part 2 timer state
  const [phase, setPhase] = useState<'idle' | 'prep' | 'speak' | 'done'>('idle');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => clearTimer, []);

  // Restore where the student left off after a hard refresh (state otherwise resets to nothing).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { part?: Part; question?: SpeakingQuestion; card?: SpeakingCueCard };
        if (saved.part) setPart(saved.part);
        if (saved.question) setQuestion(saved.question);
        if (saved.card) setCard(saved.card);
      }
    } catch {}
  }, []);

  // Persist current spot (part + whichever question/card is showing) as it changes.
  // Skip the very first run so a just-restored session isn't wiped by a stale closure.
  useEffect(() => {
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }
    try {
      if (part) {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ part, question, card }));
      } else {
        sessionStorage.removeItem(SESSION_KEY);
      }
    } catch {}
  }, [part, question, card]);

  const pool: (SpeakingQuestion | SpeakingCueCard)[] | null =
    part === 1 ? part1Pool : part === 3 ? part3Pool : part === 2 ? part2Cards : null;

  function runSpin() {
    if (!pool || pool.length === 0) return;
    clearTimer();
    setPhase('idle');
    setSecondsLeft(0);
    setSpinning(true);
    setQuestion(null);
    setCard(null);

    const { item: finalItem, index: finalIndex } = randomFrom(pool, lastIndexRef.current);
    lastIndexRef.current = finalIndex;

    let tick = 0;
    const runTick = () => {
      tick += 1;
      const isLast = tick >= SPIN_TICKS;
      const progress = tick / SPIN_TICKS;
      const shown = isLast ? finalItem : randomFrom(pool).item;

      if ('question' in shown) {
        setFlickerTopic(shown.topic);
        setFlickerText(shown.question);
      } else {
        setFlickerTopic(shown.topic);
        setFlickerText(shown.prompt);
      }

      if (isLast) {
        playReveal();
        setSpinning(false);
        if ('question' in finalItem) setQuestion(finalItem);
        else setCard(finalItem as SpeakingCueCard);
        return;
      }

      // Pitch rises slightly as the spin slows, like a wheel settling down
      playTick(1 + progress * 0.5);

      // Decelerate: ticks start fast (70ms) and slow down toward the end
      const delay = 60 + progress * progress * 260;
      window.setTimeout(runTick, delay);
    };
    runTick();
  }

  function pickPart(p: Part) {
    setPart(p);
    lastIndexRef.current = undefined;
    setQuestion(null);
    setCard(null);
    setPhase('idle');
    clearTimer();
  }

  function backToParts() {
    clearTimer();
    setPart(null);
    setQuestion(null);
    setCard(null);
    setSpinning(false);
    setPhase('idle');
  }

  function skipToSpeaking() {
    clearTimer();
    setPhase('speak');
    setSecondsLeft(SPEAK_SECONDS);
    timerRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          clearTimer();
          setPhase('done');
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  function startPrep() {
    clearTimer();
    setPhase('prep');
    setSecondsLeft(PREP_SECONDS);
    timerRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          skipToSpeaking();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  const info = part ? PART_INFO[part] : null;

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex items-center gap-3 p-4 border-b border-[var(--border)]">
        <button onClick={() => (part ? backToParts() : router.back())} className="btn-icon text-lg" aria-label="Go back">←</button>
        <h1 className="font-bold text-[var(--text)]">Speaking Practice</h1>
      </div>

      <div className="p-4 max-w-lg mx-auto w-full flex-1 flex flex-col">
        {!part && (
          <>
            <p className="text-sm text-[var(--text-muted)] mb-4">
              Every question here has appeared in a real IELTS Speaking exam. Pick a part, hit the button, and answer out loud — just for fun. No answers or vocab given, no scoring.
            </p>
            <div className="space-y-3">
              {([1, 2, 3] as Part[]).map(p => {
                const i = PART_INFO[p];
                return (
                  <button
                    key={p}
                    onClick={() => pickPart(p)}
                    className="w-full flex items-center gap-3 p-4 rounded-2xl text-left transition-transform active:scale-[0.98]"
                    style={{
                      background: `linear-gradient(135deg, ${i.light}, ${i.color}, ${i.dark})`,
                      boxShadow: `0 4px 0 ${i.dark}, 0 8px 20px ${i.color}55`,
                    }}
                  >
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
                      style={{ background: 'rgba(0,0,0,0.18)' }}
                    >
                      {i.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-white">{i.label}</p>
                      <p className="text-xs text-white/75">{i.sub}</p>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-1 rounded-lg text-white/90" style={{ background: 'rgba(0,0,0,0.2)' }}>
                      {i.count} qs
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {part && info && (
          <div className="flex-1 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <span
                className="text-xs font-bold px-3 py-1 rounded-full text-white"
                style={{ background: info.color }}
              >
                {info.icon} {info.label} · {info.sub}
              </span>
            </div>

            {/* Empty state before first spin */}
            {!spinning && !question && !card && (
              <div className="flex-1 flex flex-col items-center justify-center gap-5 py-10 text-center">
                <div className="text-5xl">{info.icon}</div>
                <p className="text-sm text-[var(--text-muted)] max-w-xs">
                  Tap the button below to get a random {info.label.toLowerCase()} question.
                </p>
                <SpinButton color={info.color} dark={info.dark} onClick={runSpin} label="Get a random question" />
              </div>
            )}

            {/* Spinning / flicker state */}
            {spinning && (
              <div className="flex-1 flex flex-col items-center justify-center gap-5 py-10">
                <p className="text-sm font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: info.color }}>
                  <span className="inline-block animate-spin" style={{ animationDuration: '0.9s' }}>🎲</span>
                  Shuffling through questions…
                </p>
                <div
                  className="rounded-3xl p-8 md:p-10 w-full min-h-[220px] flex flex-col items-center justify-center text-center"
                  style={{ background: 'var(--surface-2)', border: `2px dashed ${info.color}88` }}
                >
                  <p className="text-xs md:text-sm font-bold text-[var(--text-muted)] mb-3 uppercase tracking-wide">{flickerTopic}</p>
                  <p className="text-2xl md:text-3xl font-bold text-[var(--text)] opacity-70 leading-snug">{flickerText}</p>
                </div>
              </div>
            )}

            {/* Part 1 & 3 result */}
            {!spinning && question && (
              <div className="flex-1 flex flex-col gap-5 py-6">
                <div
                  className="rounded-3xl p-6"
                  style={{ background: `linear-gradient(135deg, ${info.light}22, ${info.color}18)`, border: `1.5px solid ${info.color}55` }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: info.color }}>{question.topic}</span>
                    <button
                      onClick={() => speak(question.question)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                      style={{ background: `${info.color}22`, color: info.color }}
                      aria-label="Read question aloud"
                    >🔊</button>
                  </div>
                  <p className="text-xl font-bold text-[var(--text)] leading-snug">{question.question}</p>
                </div>
                <p className="text-xs text-[var(--text-muted)] text-center">Answer out loud, then get another one whenever you’re ready.</p>
                <SpinButton color={info.color} dark={info.dark} onClick={runSpin} label="Next question" />
              </div>
            )}

            {/* Part 2 cue card + timer */}
            {!spinning && card && (
              <div className="flex-1 flex flex-col gap-4 py-6">
                <div
                  className="rounded-3xl p-6"
                  style={{ background: `linear-gradient(135deg, ${info.light}22, ${info.color}18)`, border: `1.5px solid ${info.color}55` }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: info.color }}>{card.topic}</span>
                    <button
                      onClick={() => speak([card.prompt, ...card.bullets, card.closing ?? ''].join('. '))}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                      style={{ background: `${info.color}22`, color: info.color }}
                      aria-label="Read cue card aloud"
                    >🔊</button>
                  </div>
                  <p className="text-lg font-bold text-[var(--text)] leading-snug mb-3">{card.prompt}</p>
                  <p className="text-xs font-semibold text-[var(--text-muted)] mb-2">You should say:</p>
                  <ul className="space-y-1.5 mb-3">
                    {card.bullets.map((b, i) => (
                      <li key={i} className="text-sm text-[var(--text)] flex gap-2">
                        <span style={{ color: info.color }}>•</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                  {card.closing && (
                    <p className="text-sm text-[var(--text)] italic">{card.closing}</p>
                  )}
                </div>

                {/* Timer flow */}
                {phase === 'idle' && (
                  <div className="flex gap-2">
                    <button
                      onClick={startPrep}
                      className="flex-1 py-3 rounded-2xl font-bold text-white text-sm"
                      style={{ background: info.color, boxShadow: `0 4px 0 ${info.dark}` }}
                    >
                      ⏱ Start 1-min prep
                    </button>
                    <button
                      onClick={skipToSpeaking}
                      className="px-4 py-3 rounded-2xl font-semibold text-sm"
                      style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
                    >
                      Skip to speaking
                    </button>
                  </div>
                )}

                {(phase === 'prep' || phase === 'speak') && (
                  <div
                    className="rounded-2xl p-5 text-center"
                    style={{ background: 'var(--surface-2)' }}
                  >
                    <p className="text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: info.color }}>
                      {phase === 'prep' ? 'Preparing… (1 min)' : 'Speaking now… (up to 2 min)'}
                    </p>
                    <p className="text-4xl font-black text-[var(--text)] tabular-nums">{formatTime(secondsLeft)}</p>
                    <div className="flex gap-2 mt-3">
                      {phase === 'prep' && (
                        <button
                          onClick={skipToSpeaking}
                          className="flex-1 py-2 rounded-xl text-xs font-semibold"
                          style={{ background: `${info.color}22`, color: info.color }}
                        >
                          Skip prep, start speaking now
                        </button>
                      )}
                      <button
                        onClick={() => { clearTimer(); setPhase('done'); }}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold"
                        style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}
                      >
                        {phase === 'prep' ? 'End early' : 'Done, I’m finished'}
                      </button>
                    </div>
                  </div>
                )}

                {phase === 'done' && (
                  <div
                    className="rounded-2xl p-4 text-center"
                    style={{ background: `${info.color}18` }}
                  >
                    <p className="text-sm font-bold" style={{ color: info.color }}>🎉 Nice work!</p>
                  </div>
                )}

                <SpinButton color={info.color} dark={info.dark} onClick={runSpin} label="Next cue card" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SpinButton({ color, dark, onClick, label }: { color: string; dark: string; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="w-full py-4 rounded-2xl font-black text-white text-base transition-transform active:scale-[0.97]"
      style={{ background: `linear-gradient(135deg, ${color}, ${dark})`, boxShadow: `0 4px 0 ${dark}` }}
    >
      🎲 {label}
    </button>
  );
}
