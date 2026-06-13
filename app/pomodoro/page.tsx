'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';

const ARC_R = 52;
const ARC_C = 2 * Math.PI * ARC_R;

const RING_R = 90;
const RING_C = 2 * Math.PI * RING_R;

const PRESETS = [
  { label: 'Classic',   emoji: '🍅', work: 25, break: 5  },
  { label: 'Deep Work', emoji: '🧠', work: 50, break: 10 },
  { label: 'Quick',     emoji: '⚡', work: 15, break: 3  },
];

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export default function PomodoroPage() {
  const router = useRouter();
  const {
    pomPhase, pomSecondsLeft, pomRunning, pomWorkMins, pomBreakMins, pomSessions,
    startPomodoro, pausePomodoro, resumePomodoro, resetPomodoro, skipPomodoro, setPomSettings,
  } = useAppStore();

  const [selectedPreset, setSelectedPreset] = useState<number | null>(0);

  useEffect(() => {
    const idx = PRESETS.findIndex(p => p.work === pomWorkMins && p.break === pomBreakMins);
    setSelectedPreset(idx >= 0 ? idx : null);
  }, []);

  const isIdle = pomPhase === 'idle';

  const selectPreset = (i: number) => {
    setSelectedPreset(i);
    setPomSettings(PRESETS[i].work, PRESETS[i].break);
  };

  // Setup arc (small, always visible when idle)
  const workFraction = pomWorkMins / (pomWorkMins + pomBreakMins);
  const workDash = workFraction * ARC_C;
  const breakDash = ARC_C - workDash;

  // Running ring (big, shows time remaining in current phase)
  const phaseTotalSeconds = pomPhase === 'work' ? pomWorkMins * 60 : pomBreakMins * 60;
  const remainFraction = phaseTotalSeconds > 0 ? pomSecondsLeft / phaseTotalSeconds : 1;
  const ringColor = pomPhase === 'work' ? '#6C63FF' : '#10B981';
  const ringDash = remainFraction * RING_C;

  return (
    <div className="flex flex-col min-h-screen animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-lg"
        >
          ←
        </button>
        <h1 className="font-bold text-[var(--text)]">Focus Mode</h1>
        <div className="w-9 h-9" />
      </div>

      <div className="p-5 flex flex-col items-center gap-5 flex-1">

        {isIdle ? (
          <>
            {/* Arc visualizer (setup mode) */}
            <div className="flex flex-col items-center gap-2 mt-2">
              <div className="relative" style={{ width: 130, height: 130 }}>
                <svg width="130" height="130">
                  <circle cx="65" cy="65" r={ARC_R} fill="none" stroke="var(--border)" strokeWidth="12" />
                  <circle
                    cx="65" cy="65" r={ARC_R} fill="none" stroke="#6C63FF" strokeWidth="12"
                    strokeDasharray={`${workDash} ${ARC_C - workDash}`}
                    style={{ transformOrigin: '65px 65px', transform: 'rotate(-90deg)', transition: 'stroke-dasharray 0.45s ease-in-out' }}
                  />
                  <circle
                    cx="65" cy="65" r={ARC_R} fill="none" stroke="#10B981" strokeWidth="12"
                    strokeDasharray={`${breakDash} ${ARC_C - breakDash}`}
                    style={{ transformOrigin: '65px 65px', transform: `rotate(${-90 + workFraction * 360}deg)`, transition: 'stroke-dasharray 0.45s ease-in-out, transform 0.45s ease-in-out' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="font-bold leading-none" style={{ fontSize: 28 }}>
                    <span style={{ color: '#6C63FF' }}>{pomWorkMins}</span>
                    <span style={{ color: '#10B981', fontSize: 18 }}>+{pomBreakMins}</span>
                  </div>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>min cycle</div>
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-5">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: '#6C63FF' }} />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Focus</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: '#10B981' }} />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Break</span>
                </div>
              </div>
            </div>

            {/* Preset cards */}
            <div className="flex gap-2 w-full">
              {PRESETS.map((p, i) => {
                const sel = selectedPreset === i;
                return (
                  <button
                    key={i}
                    onClick={() => selectPreset(i)}
                    className="flex-1 flex flex-col items-center py-3 rounded-2xl transition-all"
                    style={{
                      background: sel ? 'rgba(108,99,255,0.1)' : 'var(--surface-2)',
                      border: `1.5px solid ${sel ? '#6C63FF' : 'transparent'}`,
                    }}
                  >
                    <span style={{ fontSize: 20 }}>{p.emoji}</span>
                    <span className="text-[10px] font-semibold mt-1" style={{ color: sel ? '#6C63FF' : 'var(--text-muted)' }}>
                      {p.label}
                    </span>
                    <span className="text-xs font-bold" style={{ color: sel ? '#6C63FF' : 'var(--text)' }}>
                      {p.work}+{p.break}
                    </span>
                  </button>
                );
              })}
              <button
                onClick={() => setSelectedPreset(null)}
                className="flex flex-col items-center justify-center py-3 rounded-2xl transition-all"
                style={{
                  width: 66,
                  background: selectedPreset === null ? 'rgba(108,99,255,0.1)' : 'var(--surface-2)',
                  border: `1.5px solid ${selectedPreset === null ? '#6C63FF' : 'transparent'}`,
                }}
              >
                <span style={{ fontSize: 18 }}>⚙️</span>
                <span className="text-[10px] font-semibold mt-1" style={{ color: selectedPreset === null ? '#6C63FF' : 'var(--text-muted)' }}>
                  Custom
                </span>
              </button>
            </div>

            {/* Custom sliders */}
            {selectedPreset === null && (
              <div className="w-full space-y-3 animate-fade-in">
                <PomSliderRow label="Focus" value={pomWorkMins} min={5} max={60} step={5} color="#6C63FF"
                  onChange={v => setPomSettings(v, pomBreakMins)} />
                <PomSliderRow label="Break" value={pomBreakMins} min={1} max={20} step={1} color="#10B981"
                  onChange={v => setPomSettings(pomWorkMins, v)} />
              </div>
            )}

            {/* Start button */}
            <div className="w-full mt-auto pb-6">
              <button
                onClick={() => startPomodoro(pomWorkMins, pomBreakMins)}
                className="w-full py-4 rounded-2xl text-white font-bold text-base transition-all hover:opacity-90 active:scale-95"
                style={{ background: '#6C63FF' }}
              >
                Start Focusing
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Big countdown ring */}
            <div className="flex flex-col items-center gap-3 mt-4">
              <div className="relative" style={{ width: 220, height: 220 }}>
                <svg width="220" height="220">
                  {/* Track */}
                  <circle cx="110" cy="110" r={RING_R} fill="none"
                    stroke="var(--border)" strokeWidth="14" />
                  {/* Progress */}
                  <circle cx="110" cy="110" r={RING_R} fill="none"
                    stroke={ringColor} strokeWidth="14" strokeLinecap="round"
                    strokeDasharray={`${ringDash} ${RING_C - ringDash}`}
                    style={{ transformOrigin: '110px 110px', transform: 'rotate(-90deg)', transition: 'stroke-dasharray 1s linear' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                  <div
                    className="text-[11px] font-semibold uppercase tracking-widest"
                    style={{ color: ringColor }}
                  >
                    {pomPhase === 'work' ? 'Focus' : 'Break'}
                  </div>
                  <div
                    className="font-bold tabular-nums"
                    style={{ fontSize: 44, color: 'var(--text)', lineHeight: 1 }}
                  >
                    {fmt(pomSecondsLeft)}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {pomRunning ? 'running' : 'paused'}
                  </div>
                </div>
              </div>

              {/* Controls: pause/resume + skip */}
              <div className="flex items-center gap-4">
                <button
                  onClick={pomRunning ? pausePomodoro : resumePomodoro}
                  className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold transition-all hover:opacity-80 active:scale-95"
                  style={{ background: ringColor, color: '#fff' }}
                >
                  {pomRunning ? '⏸' : '▶'}
                </button>
                <button
                  onClick={skipPomodoro}
                  className="w-11 h-11 rounded-full flex items-center justify-center text-lg transition-all hover:opacity-80"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
                >
                  ⏭
                </button>
              </div>

              {/* Session dots */}
              <div className="flex items-center gap-2 mt-1">
                {Array.from({ length: Math.max(4, pomSessions + 1) }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-full transition-all"
                    style={{
                      width: i < pomSessions ? 10 : 8,
                      height: i < pomSessions ? 10 : 8,
                      background: i < pomSessions ? '#6C63FF' : 'var(--border)',
                    }}
                  />
                ))}
                {pomSessions > 0 && (
                  <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>
                    {pomSessions} done
                  </span>
                )}
              </div>
            </div>

            {/* Stop button */}
            <div className="w-full mt-auto pb-6">
              <button
                onClick={resetPomodoro}
                className="w-full py-3 rounded-2xl text-sm font-semibold transition-all hover:opacity-80"
                style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
              >
                Stop Timer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PomSliderRow({ label, value, min, max, step, color, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  color: string; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 text-xs font-semibold shrink-0" style={{ color }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(+e.target.value)}
        className="flex-1" style={{ accentColor: color }} />
      <span className="w-12 text-xs font-bold text-right shrink-0" style={{ color }}>{value} min</span>
    </div>
  );
}
