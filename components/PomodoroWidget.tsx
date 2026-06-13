'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';

type PomPhase = 'idle' | 'work' | 'break';

function fmt(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ── Sound ────────────────────────────────────────────────────────────────────

function playBeep(toBreak: boolean) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    // toBreak = descending (relax), toWork = ascending (energise)
    const freqs = toBreak ? [880, 660, 440] : [440, 660, 880];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.18);
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.18);
      gain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + i * 0.18 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.38);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.4);
    });
  } catch {}
}

// ── Notification ─────────────────────────────────────────────────────────────

function requestNotifPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'default') Notification.requestPermission();
}

function sendNotification(title: string, body: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (!document.hidden) return; // only when app is backgrounded
  try { new Notification(title, { body, icon: '/icon-192.png' }); } catch {}
}

// ── Break tips ────────────────────────────────────────────────────────────────

const BREAK_TIPS = [
  { icon: '🚶', text: 'Take a short walk to stretch your legs and refresh your mind.' },
  { icon: '💧', text: 'Drink a glass of water — staying hydrated sharpens focus.' },
  { icon: '👀', text: 'Look at something 20 feet away for 20 seconds to rest your eyes.' },
  { icon: '🧘', text: 'Take 5 slow deep breaths to calm your nervous system.' },
  { icon: '🙆', text: 'Roll your neck and shoulders to release tension from studying.' },
  { icon: '☀️', text: 'Step outside for a moment — natural light boosts your mood.' },
  { icon: '😌', text: 'Close your eyes and let your mind go blank for 60 seconds.' },
  { icon: '🍎', text: 'Grab a healthy snack to keep your brain fuelled and sharp.' },
  { icon: '🎵', text: 'Listen to one song you enjoy — music resets your energy.' },
  { icon: '✍️', text: 'Jot down anything on your mind so you can focus fully after the break.' },
];

const STORAGE_KEY = 'pom-widget-pos';

// ── Main component ────────────────────────────────────────────────────────────

export default function PomodoroWidget() {
  const router = useRouter();
  const {
    pomPhase, pomSecondsLeft, pomRunning, pomSessions, pomVisible,
    pomWorkMins, pomBreakMins,
    pausePomodoro, resumePomodoro, skipPomodoro, tickPomodoro, resetPomodoro,
    startPomodoro, hidePomodoroSetup, setPomSettings,
  } = useAppStore();

  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const posRef = useRef<{ x: number; y: number } | null>(null);
  const drag = useRef<{
    startCX: number; startCY: number;
    startEX: number; startEY: number;
    moved: boolean;
  } | null>(null);
  const wasDrag = useRef(false);
  const elemRef = useRef<HTMLDivElement>(null);
  const prevPhaseRef = useRef<PomPhase>('idle');
  const [tipIndex, setTipIndex] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Initialise widget position
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const p = JSON.parse(stored) as { x: number; y: number };
        posRef.current = p;
        setPos(p);
        return;
      } catch {}
    }
    const p = { x: Math.max(8, window.innerWidth - 168), y: 64 };
    posRef.current = p;
    setPos(p);
  }, []);

  // Tick interval lives here so the timer survives navigation
  useEffect(() => {
    if (!pomRunning) return;
    const id = setInterval(tickPomodoro, 1000);
    return () => clearInterval(id);
  }, [pomRunning, tickPomodoro]);

  // Detect phase transitions → sound + notification
  useEffect(() => {
    const prev = prevPhaseRef.current;
    if (prev === pomPhase) return;
    prevPhaseRef.current = pomPhase;

    if (pomPhase === 'break') {
      playBeep(true);
      sendNotification('Break Time! ☕', `Great work! Take a ${pomBreakMins} min break — you earned it.`);
      setTipIndex(Math.floor(Math.random() * BREAK_TIPS.length));
    } else if (pomPhase === 'work') {
      playBeep(false);
      sendNotification('Focus Time! 🎯', `${pomWorkMins} min work session starting now. Let's go!`);
    }
  }, [pomPhase, pomBreakMins, pomWorkMins]);

  // Cycle tips every 8 s during break
  useEffect(() => {
    if (pomPhase !== 'break') return;
    const id = setInterval(() => setTipIndex(i => (i + 1) % BREAK_TIPS.length), 8000);
    return () => clearInterval(id);
  }, [pomPhase]);

  if (!pomVisible || !pos || !mounted) return null;

  const isSetup = pomPhase === 'idle';
  const isBreak = pomPhase === 'break';
  const isWork  = pomPhase === 'work';

  // ── Drag handlers ─────────────────────────────────────────────────────────
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!posRef.current) return;
    wasDrag.current = false;
    drag.current = {
      startCX: e.clientX, startCY: e.clientY,
      startEX: posRef.current.x, startEY: posRef.current.y,
      moved: false,
    };
    elemRef.current?.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.startCX;
    const dy = e.clientY - drag.current.startCY;
    if (!drag.current.moved && Math.hypot(dx, dy) <= 4) return;
    drag.current.moved = true;
    const el = elemRef.current;
    const w = el?.offsetWidth ?? 240;
    const h = el?.offsetHeight ?? 48;
    const nx = Math.max(8, Math.min(window.innerWidth - w - 8, drag.current.startEX + dx));
    const ny = Math.max(8, Math.min(window.innerHeight - h - 8, drag.current.startEY + dy));
    const p = { x: nx, y: ny };
    posRef.current = p;
    setPos(p);
  }

  function onPointerUp() {
    if (!drag.current) return;
    if (drag.current.moved && posRef.current) {
      wasDrag.current = true;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(posRef.current));
    }
    drag.current = null;
  }

  // ── Break overlay (portal, full-screen) ───────────────────────────────────
  if (isBreak) {
    const tip = BREAK_TIPS[tipIndex % BREAK_TIPS.length];
    const breakProgress = 1 - pomSecondsLeft / (pomBreakMins * 60);

    return createPortal(
      <div className="fixed inset-0 z-40 flex items-center justify-center">
        {/* Blurred backdrop */}
        <div
          className="absolute inset-0"
          style={{ backdropFilter: 'blur(16px)', background: 'rgba(0,0,0,0.45)' }}
        />

        {/* Card */}
        <div
          className="relative z-10 mx-5 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden"
          style={{ background: 'rgba(16,185,129,0.95)', backdropFilter: 'blur(20px)' }}
        >
          {/* Stop session button */}
          <button
            onClick={resetPomodoro}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white text-sm transition-colors z-10"
            aria-label="Stop session"
          >✕</button>
          {/* Progress bar at top */}
          <div className="h-1.5 bg-white/20">
            <div
              className="h-full bg-white transition-all duration-1000"
              style={{ width: `${breakProgress * 100}%` }}
            />
          </div>

          <div className="p-6">
            {/* Header */}
            <div className="text-center mb-5">
              <div className="text-5xl mb-2">☕</div>
              <h2 className="text-white text-2xl font-black">Break Time</h2>
              {pomSessions > 0 && (
                <p className="text-white/70 text-sm mt-0.5">
                  Session {pomSessions} complete 🎉
                </p>
              )}
            </div>

            {/* Countdown */}
            <div className="text-center mb-5">
              <span className="text-white text-7xl font-black tabular-nums leading-none">
                {fmt(pomSecondsLeft)}
              </span>
              <p className="text-white/60 text-xs mt-1">of {pomBreakMins} min break</p>
            </div>

            {/* Tip card */}
            <div
              className="rounded-2xl p-4 mb-5 min-h-[84px] flex flex-col items-center justify-center text-center gap-2"
              style={{ background: 'rgba(255,255,255,0.15)' }}
            >
              <span className="text-3xl">{tip.icon}</span>
              <p className="text-white text-sm font-medium leading-relaxed">{tip.text}</p>
            </div>

            {/* Controls */}
            <div className="flex gap-3">
              <button
                onClick={pomRunning ? pausePomodoro : resumePomodoro}
                className="flex-1 py-3 rounded-xl text-white text-sm font-bold transition-colors"
                style={{ background: 'rgba(255,255,255,0.2)' }}
              >
                {pomRunning ? '⏸ Pause' : '▶ Resume'}
              </button>
              <button
                onClick={skipPomodoro}
                className="flex-1 py-3 rounded-xl bg-white text-emerald-600 text-sm font-black transition-colors hover:bg-white/90"
              >
                Skip →
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  // ── Setup panel ───────────────────────────────────────────────────────────
  if (isSetup) {
    return (
      <div
        ref={elemRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="fixed z-50 rounded-2xl shadow-xl cursor-move select-none"
        style={{
          left: pos.x, top: pos.y, width: 240,
          background: 'rgba(108,99,255,0.97)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.25)',
          touchAction: 'none',
        }}
      >
        <div className="flex items-center justify-between px-3 pt-3 pb-2">
          <span className="text-white text-sm font-bold">🍅 Focus Timer</span>
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); hidePomodoroSetup(); }}
            className="w-6 h-6 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white text-xs transition-colors"
          >✕</button>
        </div>

        <div className="px-3 pb-2 space-y-3">
          <TimeRow label="Work" value={pomWorkMins} min={5} max={60}
            onChange={v => setPomSettings(v, pomBreakMins)} />
          <TimeRow label="Break" value={pomBreakMins} min={1} max={20}
            onChange={v => setPomSettings(pomWorkMins, v)} />
        </div>

        <div className="px-3 pb-3 space-y-2">
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={e => {
              e.stopPropagation();
              requestNotifPermission();
              startPomodoro(pomWorkMins, pomBreakMins);
            }}
            className="w-full py-2 rounded-xl bg-white text-[#6C63FF] text-sm font-black hover:bg-white/90 transition-colors"
          >
            ▶ Start Timer
          </button>
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); hidePomodoroSetup(); }}
            className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 text-xs font-semibold transition-colors"
          >
            Discard & close
          </button>
        </div>
      </div>
    );
  }

  // ── Running work timer (compact draggable widget) ─────────────────────────
  const accentColor = isWork ? '#6C63FF' : '#10B981';
  const timeStr = fmt(pomSecondsLeft);

  return (
    <div
      ref={elemRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onClick={() => { if (wasDrag.current) { wasDrag.current = false; return; } router.push('/pomodoro'); }}
      className="fixed z-50 cursor-move select-none overflow-hidden"
      style={{
        left: pos.x, top: pos.y,
        width: 158,
        borderRadius: 16,
        background: 'rgba(8, 8, 18, 0.97)',
        border: `1px solid ${accentColor}44`,
        boxShadow: `0 8px 28px rgba(0,0,0,0.5), 0 0 0 1px ${accentColor}18`,
        touchAction: 'none',
      }}
    >
      <div style={{ padding: '8px 12px 10px' }}>
        {/* Phase + session count */}
        <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
            color: accentColor, textTransform: 'uppercase',
          }}>
            {isWork ? '🎯 Focus' : '☕ Break'}
          </span>
          {pomSessions > 0 && (
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>×{pomSessions}</span>
          )}
        </div>

        {/* Flip countdown digits */}
        <div className="flex items-center justify-center" style={{ marginBottom: 8, gap: 0 }}>
          {timeStr.split('').map((char, i) => (
            <span
              key={`${i}-${char}`}
              style={{
                display: 'inline-block',
                fontFamily: '"Courier New", "Lucida Console", monospace',
                fontSize: char === ':' ? 20 : 26,
                fontWeight: 900,
                lineHeight: 1,
                color: char === ':' ? 'rgba(255,255,255,0.35)' : '#ffffff',
                letterSpacing: '-0.03em',
                padding: char === ':' ? '0 2px' : '0 1px',
                textShadow: char !== ':' ? `0 0 14px ${accentColor}80` : 'none',
                animation: char !== ':' ? 'digit-flip-in 0.28s ease-out' : 'none',
              }}
            >
              {char}
            </span>
          ))}
        </div>

      </div>
    </div>
  );
}

// ── Slider row ────────────────────────────────────────────────────────────────

function TimeRow({ label, value, min, max, onChange }: {
  label: string; value: number; min: number; max: number; onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-white/80 text-xs font-medium">{label}</span>
        <span className="text-white text-sm font-black tabular-nums">{value} min</span>
      </div>
      <input
        type="range" min={min} max={max} value={value}
        onChange={e => onChange(parseInt(e.target.value))}
        onPointerDown={e => e.stopPropagation()}
        className="w-full h-1.5 cursor-pointer accent-white"
      />
      <div className="flex justify-between text-white/40 text-[10px]">
        <span>{min}m</span>
        <span>{max}m</span>
      </div>
    </div>
  );
}
