'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';

function fmt(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

const RADIUS = 90;
const CIRC = 2 * Math.PI * RADIUS;

const ARC_R = 52;
const ARC_C = 2 * Math.PI * ARC_R;

const PRESETS = [
  { label: 'Classic',   emoji: '🍅', work: 25, break: 5  },
  { label: 'Deep Work', emoji: '🧠', work: 50, break: 10 },
  { label: 'Quick',     emoji: '⚡', work: 15, break: 3  },
];

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

  const selectPreset = (i: number) => {
    setSelectedPreset(i);
    setPomSettings(PRESETS[i].work, PRESETS[i].break);
  };

  const selectCustom = () => setSelectedPreset(null);

  const isIdle = pomPhase === 'idle';
  const totalSecs = pomPhase === 'break' ? pomBreakMins * 60 : pomWorkMins * 60;
  const progress = isIdle ? 0 : (totalSecs - pomSecondsLeft) / totalSecs;
  const ringColor = pomPhase === 'break' ? '#10B981' : pomPhase === 'work' ? '#6C63FF' : '#CBD5E1';

  const workFraction = pomWorkMins / (pomWorkMins + pomBreakMins);
  const workDash = workFraction * ARC_C;
  const breakDash = ARC_C - workDash;

  const handlePlayPause = () => {
    if (isIdle) {
      startPomodoro(pomWorkMins, pomBreakMins);
    } else if (pomRunning) {
      pausePomodoro();
    } else {
      resumePomodoro();
    }
  };

  return (
    <div className="flex flex-col min-h-screen animate-fade-in pb-8">
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

      <div className="p-4 flex flex-col items-center gap-6 flex-1">
        {/* Session dots */}
        <div className="flex gap-2 justify-center pt-2">
          {Array.from({ length: Math.max(pomSessions + 1, 4) }).map((_, i) => (
            <div
              key={i}
              className="w-3 h-3 rounded-full transition-all duration-300"
              style={{ background: i < pomSessions ? '#EF4444' : 'var(--border)' }}
            />
          ))}
        </div>

        {/* Circular ring timer */}
        <div className="relative w-60 h-60 flex items-center justify-center">
          <svg
            className="absolute w-60 h-60"
            style={{ transform: 'rotate(-90deg)' }}
            viewBox="0 0 200 200"
          >
            <circle
              cx="100" cy="100" r={RADIUS}
              fill="none"
              stroke="var(--border)"
              strokeWidth="10"
            />
            <circle
              cx="100" cy="100" r={RADIUS}
              fill="none"
              stroke={ringColor}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - progress)}
              style={{ transition: 'stroke-dashoffset 0.6s linear, stroke 0.4s ease' }}
            />
          </svg>
          <div className="z-10 text-center">
            <div className="text-5xl font-black text-[var(--text)] tabular-nums tracking-tight">
              {fmt(isIdle ? pomWorkMins * 60 : pomSecondsLeft)}
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-1">
              {pomSessions} session{pomSessions !== 1 ? 's' : ''} completed
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-5">
          {!isIdle && (
            <button
              onClick={skipPomodoro}
              className="w-12 h-12 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-lg text-[var(--text-muted)] hover:bg-[var(--border)] transition-colors"
              title="Skip to next phase"
            >
              ⏭
            </button>
          )}

          <button
            onClick={handlePlayPause}
            className="w-20 h-20 rounded-full flex items-center justify-center text-3xl text-white font-bold shadow-xl transition-transform hover:scale-105 active:scale-95"
            style={{ background: ringColor }}
          >
            {pomRunning ? '⏸' : '▶'}
          </button>

          {!isIdle && (
            <button
              onClick={resetPomodoro}
              className="w-12 h-12 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-lg text-[var(--text-muted)] hover:bg-[var(--border)] transition-colors"
              title="Reset"
            >
              ↺
            </button>
          )}
        </div>

        {/* Settings — redesigned, only shown when idle */}
        {isIdle && (
          <div className="w-full space-y-5 animate-fade-in">

            {/* Arc visualizer */}
            <div className="flex flex-col items-center gap-2">
              <div className="relative" style={{ width: 130, height: 130 }}>
                <svg width="130" height="130">
                  {/* track */}
                  <circle
                    cx="65" cy="65" r={ARC_R}
                    fill="none"
                    stroke="var(--border)"
                    strokeWidth="12"
                  />
                  {/* focus arc */}
                  <circle
                    cx="65" cy="65" r={ARC_R}
                    fill="none"
                    stroke="#6C63FF"
                    strokeWidth="12"
                    strokeDasharray={`${workDash} ${ARC_C - workDash}`}
                    style={{
                      transformOrigin: '65px 65px',
                      transform: 'rotate(-90deg)',
                      transition: 'stroke-dasharray 0.45s ease-in-out',
                    }}
                  />
                  {/* break arc */}
                  <circle
                    cx="65" cy="65" r={ARC_R}
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="12"
                    strokeDasharray={`${breakDash} ${ARC_C - breakDash}`}
                    style={{
                      transformOrigin: '65px 65px',
                      transform: `rotate(${-90 + workFraction * 360}deg)`,
                      transition: 'stroke-dasharray 0.45s ease-in-out, transform 0.45s ease-in-out',
                    }}
                  />
                </svg>
                {/* Center text */}
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

            {/* Preset cards + custom */}
            <div className="flex gap-2">
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
                onClick={selectCustom}
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

            {/* Custom sliders — only when Custom selected */}
            {selectedPreset === null && (
              <div className="space-y-3 animate-fade-in">
                <PomSliderRow
                  label="Focus"
                  value={pomWorkMins}
                  min={5} max={60} step={5}
                  color="#6C63FF"
                  onChange={v => setPomSettings(v, pomBreakMins)}
                />
                <PomSliderRow
                  label="Break"
                  value={pomBreakMins}
                  min={1} max={20} step={1}
                  color="#10B981"
                  onChange={v => setPomSettings(pomWorkMins, v)}
                />
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

function PomSliderRow({
  label, value, min, max, step, color, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number;
  color: string; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 text-xs font-semibold shrink-0" style={{ color }}>{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(+e.target.value)}
        className="flex-1"
        style={{ accentColor: color }}
      />
      <span className="w-12 text-xs font-bold text-right shrink-0" style={{ color }}>
        {value} min
      </span>
    </div>
  );
}
