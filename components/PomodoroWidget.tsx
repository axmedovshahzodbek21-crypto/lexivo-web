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

  const [panelPos, setPanelPos] = useState<{ x: number; y: number } | null>(null);
  const panelPosRef = useRef<{ x: number; y: number } | null>(null);
  const panelDrag = useRef<{
    startCX: number; startCY: number;
    startEX: number; startEY: number;
    moved: boolean;
  } | null>(null);
  const prevPhaseRef = useRef<PomPhase>('idle');
  const [tipIndex, setTipIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [customMode, setCustomMode] = useState(false);

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

  // Initialise panel position when it opens, clear when it closes
  useEffect(() => {
    if (panelOpen && pos) {
      const p = { x: pos.x, y: pos.y + 60 };
      panelPosRef.current = p;
      setPanelPos(p);
    } else if (!panelOpen) {
      panelPosRef.current = null;
      setPanelPos(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelOpen]);

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

  function onPanelPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!panelPosRef.current) return;
    panelDrag.current = {
      startCX: e.clientX, startCY: e.clientY,
      startEX: panelPosRef.current.x, startEY: panelPosRef.current.y,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPanelPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!panelDrag.current) return;
    const dx = e.clientX - panelDrag.current.startCX;
    const dy = e.clientY - panelDrag.current.startCY;
    if (!panelDrag.current.moved && Math.hypot(dx, dy) <= 4) return;
    panelDrag.current.moved = true;
    const w = e.currentTarget.offsetWidth;
    const h = e.currentTarget.offsetHeight;
    const nx = Math.max(8, Math.min(window.innerWidth - w - 8, panelDrag.current.startEX + dx));
    const ny = Math.max(8, Math.min(window.innerHeight - h - 8, panelDrag.current.startEY + dy));
    const p = { x: nx, y: ny };
    panelPosRef.current = p;
    setPanelPos(p);
  }

  function onPanelPointerUp() {
    panelDrag.current = null;
  }

  // ── Break overlay (portal, full-screen) ───────────────────────────────────
  if (isBreak) {
    const tip = BREAK_TIPS[tipIndex % BREAK_TIPS.length];
    const breakProgress = 1 - pomSecondsLeft / (pomBreakMins * 60);

    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center">
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

  const SETUP_PRESETS = [
    { label: 'Classic', emoji: '🍅', work: 25, brk: 5 },
    { label: 'Deep',    emoji: '🧠', work: 50, brk: 10 },
    { label: 'Quick',   emoji: '⚡', work: 15, brk: 3 },
  ];

  // ── Setup panel ───────────────────────────────────────────────────────────
  if (isSetup) {
    const isCustom = customMode;

    return (
      <div
        ref={elemRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="fixed z-50 cursor-move select-none"
        style={{
          left: pos.x, top: pos.y, width: 260,
          borderRadius: 20,
          background: 'rgba(10, 10, 24, 0.96)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(108,99,255,0.35)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(108,99,255,0.1)',
          touchAction: 'none',
        }}
      >
        {/* Header */}
        <div style={{ padding: '14px 14px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 18 }}>🎯</span>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 14, letterSpacing: '-0.3px' }}>Focus Mode</span>
          </div>
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); hidePomodoroSetup(); }}
            style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >✕</button>
        </div>

        {/* Time display */}
        <div style={{ padding: '12px 14px 0', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 36, fontWeight: 900, color: '#6C63FF', lineHeight: 1 }}>{pomWorkMins}</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: '#10B981', lineHeight: 1 }}>+{pomBreakMins}</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginLeft: 2 }}>min</span>
          </div>
        </div>

        {/* Preset cards */}
        <div style={{ padding: '10px 14px 0', display: 'flex', gap: 6 }}>
          {SETUP_PRESETS.map(p => {
            const sel = !customMode && p.work === pomWorkMins && p.brk === pomBreakMins;
            return (
              <button
                key={p.label}
                onPointerDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); setCustomMode(false); setPomSettings(p.work, p.brk); }}
                style={{
                  flex: 1, padding: '8px 4px', borderRadius: 12, border: `1.5px solid ${sel ? '#6C63FF' : 'rgba(255,255,255,0.08)'}`,
                  background: sel ? 'rgba(108,99,255,0.25)' : 'rgba(255,255,255,0.05)',
                  cursor: 'pointer', transition: 'all 0.15s',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                }}
              >
                <span style={{ fontSize: 16 }}>{p.emoji}</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: sel ? '#a89fff' : 'rgba(255,255,255,0.4)', letterSpacing: '0.04em' }}>{p.label}</span>
                <span style={{ fontSize: 10, fontWeight: 800, color: sel ? '#fff' : 'rgba(255,255,255,0.5)' }}>{p.work}+{p.brk}</span>
              </button>
            );
          })}
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); setCustomMode(true); }}
            style={{
              width: 52, padding: '8px 4px', borderRadius: 12,
              border: `1.5px solid ${isCustom ? '#6C63FF' : 'rgba(255,255,255,0.08)'}`,
              background: isCustom ? 'rgba(108,99,255,0.25)' : 'rgba(255,255,255,0.05)',
              cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            }}
          >
            <span style={{ fontSize: 16 }}>⚙️</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: isCustom ? '#a89fff' : 'rgba(255,255,255,0.4)' }}>Custom</span>
          </button>
        </div>

        {/* Custom sliders — only when custom selected */}
        {isCustom && (
          <div style={{ padding: '10px 14px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <MiniSlider label="Focus" value={pomWorkMins} min={5} max={60} color="#6C63FF"
              onChange={v => setPomSettings(v, pomBreakMins)} />
            <MiniSlider label="Break" value={pomBreakMins} min={1} max={20} color="#10B981"
              onChange={v => setPomSettings(pomWorkMins, v)} />
          </div>
        )}

        {/* Start button */}
        <div style={{ padding: '12px 14px 14px' }}>
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); requestNotifPermission(); startPomodoro(pomWorkMins, pomBreakMins); }}
            style={{
              width: '100%', padding: '11px 0', borderRadius: 14, border: 'none',
              background: 'linear-gradient(135deg, #6C63FF, #8b85ff)',
              color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(108,99,255,0.4)',
            }}
          >
            Start Focusing
          </button>
        </div>
      </div>
    );
  }

  // ── Running work timer (compact draggable widget) ─────────────────────────
  const accentColor = isWork ? '#6C63FF' : '#10B981';
  const timeStr = fmt(pomSecondsLeft);

  const cardStyle = {
    borderRadius: 20,
    background: 'rgba(10, 10, 24, 0.96)',
    backdropFilter: 'blur(20px)',
    border: `1px solid ${accentColor}55`,
    boxShadow: `0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px ${accentColor}18`,
  };

  return (
    <>
      {/* Expanded panel — shown when widget is tapped */}
      {panelOpen && createPortal(
        <div
          onPointerDown={onPanelPointerDown}
          onPointerMove={onPanelPointerMove}
          onPointerUp={onPanelPointerUp}
          className="fixed z-50 cursor-move select-none"
          style={{ left: panelPos?.x ?? pos?.x ?? 0, top: panelPos?.y ?? (pos?.y ?? 0) + 60, width: 260, touchAction: 'none', ...cardStyle }}
        >
          {/* Header */}
          <div style={{ padding: '14px 14px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: accentColor, fontWeight: 800, fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {isWork ? '🎯 Focus' : '☕ Break'}
            </span>
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={() => setPanelOpen(false)}
              style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >✕</button>
          </div>

          {/* Big countdown */}
          <div style={{ padding: '10px 14px 4px', textAlign: 'center' }}>
            <div style={{ fontSize: 52, fontWeight: 900, color: '#fff', lineHeight: 1, fontFamily: '"Courier New", monospace', letterSpacing: '-2px', textShadow: `0 0 24px ${accentColor}80` }}>
              {timeStr}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
              {pomRunning ? 'running' : 'paused'}
            </div>
          </div>

          {/* Session dots */}
          {pomSessions > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '6px 0 0' }}>
              {Array.from({ length: pomSessions }).map((_, i) => (
                <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: accentColor }} />
              ))}
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginLeft: 2 }}>{pomSessions} done</span>
            </div>
          )}

          {/* Controls */}
          <div style={{ padding: '12px 14px 14px', display: 'flex', gap: 8 }}>
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={() => { pomRunning ? pausePomodoro() : resumePomodoro(); }}
              style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: 'none', background: accentColor, color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer' }}
            >
              {pomRunning ? '⏸' : '▶'}
            </button>
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={skipPomodoro}
              style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', fontWeight: 800, fontSize: 16, cursor: 'pointer' }}
            >
              ⏭
            </button>
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={() => { resetPomodoro(); setPanelOpen(false); }}
              style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.35)', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}
            >
              Stop
            </button>
          </div>
        </div>,
        document.body,
      )}

    <div
      ref={elemRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onClick={() => { if (wasDrag.current) { wasDrag.current = false; return; } setPanelOpen(p => !p); }}
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
                fontSize: char === ':' ? 28 : 36,
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
    </>
  );
}

// ── Mini slider ───────────────────────────────────────────────────────────────

function MiniSlider({ label, value, min, max, color, onChange }: {
  label: string; value: number; min: number; max: number; color: string; onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 34, fontSize: 10, fontWeight: 700, color, flexShrink: 0 }}>{label}</span>
      <input
        type="range" min={min} max={max} value={value}
        onChange={e => onChange(+e.target.value)}
        onPointerDown={e => e.stopPropagation()}
        style={{ flex: 1, accentColor: color, cursor: 'pointer' }}
      />
      <span style={{ width: 40, fontSize: 10, fontWeight: 800, color, textAlign: 'right', flexShrink: 0 }}>{value}m</span>
    </div>
  );
}
