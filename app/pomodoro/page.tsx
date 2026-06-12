'use client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';

function fmt(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

const RADIUS = 90;
const CIRC = 2 * Math.PI * RADIUS;

export default function PomodoroPage() {
  const router = useRouter();
  const {
    pomPhase, pomSecondsLeft, pomRunning, pomWorkMins, pomBreakMins, pomSessions,
    startPomodoro, pausePomodoro, resumePomodoro, resetPomodoro, skipPomodoro, setPomSettings,
  } = useAppStore();

  const isIdle = pomPhase === 'idle';
  const totalSecs = pomPhase === 'break' ? pomBreakMins * 60 : pomWorkMins * 60;
  const progress = isIdle ? 0 : (totalSecs - pomSecondsLeft) / totalSecs;
  const ringColor = pomPhase === 'break' ? '#10B981' : pomPhase === 'work' ? '#6C63FF' : '#CBD5E1';
  const phaseBg = pomPhase === 'break' ? 'rgba(16,185,129,0.1)' : 'rgba(108,99,255,0.1)';
  const phaseText = pomPhase === 'break' ? '#10B981' : '#6C63FF';

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
        <h1 className="font-bold text-[var(--text)]">🍅 Pomodoro</h1>
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

        {/* Phase label */}
        <div
          className="px-5 py-1.5 rounded-full text-sm font-semibold"
          style={{ background: phaseBg, color: phaseText }}
        >
          {isIdle
            ? 'Ready to focus'
            : pomPhase === 'work'
            ? '🎯 Focus Time'
            : '☕ Break Time'}
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

        {/* Settings — only shown when idle */}
        {isIdle && (
          <div className="w-full card space-y-5 animate-fade-in">
            <h3 className="font-semibold text-[var(--text)] text-sm">Timer Settings</h3>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-[var(--text)]">🎯 Focus time</span>
                <span
                  className="text-sm font-bold px-2.5 py-0.5 rounded-lg"
                  style={{ background: 'rgba(108,99,255,0.1)', color: '#6C63FF' }}
                >
                  {pomWorkMins} min
                </span>
              </div>
              <input
                type="range" min="5" max="60" step="5" value={pomWorkMins}
                onChange={e => setPomSettings(+e.target.value, pomBreakMins)}
                className="w-full"
                style={{ accentColor: '#6C63FF' }}
              />
              <div className="flex justify-between text-xs text-[var(--text-muted)] mt-1">
                <span>5 min</span><span>60 min</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-[var(--text)]">☕ Break time</span>
                <span
                  className="text-sm font-bold px-2.5 py-0.5 rounded-lg"
                  style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981' }}
                >
                  {pomBreakMins} min
                </span>
              </div>
              <input
                type="range" min="1" max="20" step="1" value={pomBreakMins}
                onChange={e => setPomSettings(pomWorkMins, +e.target.value)}
                className="w-full"
                style={{ accentColor: '#10B981' }}
              />
              <div className="flex justify-between text-xs text-[var(--text-muted)] mt-1">
                <span>1 min</span><span>20 min</span>
              </div>
            </div>

            {/* Cycle preview */}
            <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--surface-2)] text-sm flex-wrap">
              <span className="font-semibold" style={{ color: '#6C63FF' }}>🎯 {pomWorkMins}m</span>
              <span className="text-[var(--text-muted)]">→</span>
              <span className="font-semibold" style={{ color: '#10B981' }}>☕ {pomBreakMins}m</span>
              <span className="text-[var(--text-muted)]">→</span>
              <span className="text-[var(--text-muted)]">🔄 repeat</span>
            </div>
          </div>
        )}

        {/* After a phase ends, quick-link to learn */}
        {!pomRunning && !isIdle && (
          <Link
            href="/learn"
            className="btn-primary w-full text-center text-sm py-3"
          >
            📖 Start Learning Session →
          </Link>
        )}
      </div>
    </div>
  );
}
