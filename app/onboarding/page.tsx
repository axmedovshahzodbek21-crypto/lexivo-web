'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { saveSettings, setOnboarded, isOnboarded } from '@/lib/storage';
import type { UserSettings } from '@/lib/types';

// ── Data ────────────────────────────────────────────────────────────────────

const LEVELS: Array<{
  code: UserSettings['languageLevel'];
  name: string;
  desc: string;
  color: string;
}> = [
  { code: 'A1', name: 'Beginner',           desc: 'Just starting out',            color: '#2ECC71' },
  { code: 'A2', name: 'Elementary',          desc: 'Basic conversations',          color: '#27AE60' },
  { code: 'B1', name: 'Intermediate',        desc: 'Everyday topics',              color: '#3498DB' },
  { code: 'B2', name: 'Upper-Intermediate',  desc: 'Fluent in most situations',    color: '#2980B9' },
  { code: 'C1', name: 'Advanced',            desc: 'Complex & nuanced language',   color: '#9B59B6' },
  { code: 'C2', name: 'Mastery',             desc: 'Near-native proficiency',      color: '#6C3483' },
];

const GOALS: Array<{ value: number; emoji: string; label: string; sub: string }> = [
  { value: 5,  emoji: '☕', label: 'Casual',     sub: '~3 min / day' },
  { value: 10, emoji: '📚', label: 'Regular',    sub: '~7 min / day' },
  { value: 15, emoji: '🚀', label: 'Committed',  sub: '~10 min / day' },
  { value: 20, emoji: '🔥', label: 'Intensive',  sub: '~15 min / day' },
];

// ── Component ────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [level, setLevel] = useState<UserSettings['languageLevel']>('B1');
  const [goal, setGoal] = useState(10);
  const [finishing, setFinishing] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  // Already onboarded → skip straight home
  useEffect(() => {
    if (isOnboarded()) router.replace('/');
  }, [router]);

  useEffect(() => {
    if (step === 1) nameRef.current?.focus();
  }, [step]);

  const next = () => setStep(s => s + 1);

  const finish = () => {
    setFinishing(true);
    saveSettings({ name: name.trim() || 'Learner', dailyGoal: goal, languageLevel: level, defaultAccent: 'us', autoPlayOnReveal: true, sessionSize: 20, fontSize: 'normal', studyOrder: 'random', quizDirection: 'word-to-uz', reduceMotion: false, uiLanguage: 'en' });
    setOnboarded();
    setTimeout(() => router.replace('/'), 1200);
  };

  const dots = [0, 1, 2, 3];

  return (
    <div className="fixed inset-0 z-[100] bg-[var(--bg)] flex flex-col overflow-hidden">
      {/* Step dots */}
      {step < 4 && (
        <div className="flex justify-center gap-2 pt-10 pb-2 shrink-0">
          {dots.map(i => (
            <div
              key={i}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === step ? 24 : 8,
                background: i <= step ? 'var(--primary)' : 'var(--border)',
              }}
            />
          ))}
        </div>
      )}

      {/* Steps */}
      <div className="flex-1 overflow-y-auto">
        {step === 0 && <StepWelcome onNext={next} />}
        {step === 1 && <StepName name={name} onChange={setName} onNext={next} inputRef={nameRef} />}
        {step === 2 && <StepLevel level={level} onChange={setLevel} onNext={next} />}
        {step === 3 && <StepGoal goal={goal} onChange={setGoal} name={name} onFinish={finish} />}
        {step === 4 && <StepDone name={name} level={level} goal={goal} finishing={finishing} onFinish={finish} />}
      </div>
    </div>
  );
}

// ── Step 0: Welcome ──────────────────────────────────────────────────────────

function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-full px-8 py-12 text-center gap-8">
      <div className="text-7xl animate-bounce">📖</div>

      <div>
        <h1 className="text-4xl font-black text-[var(--text)] mb-3">
          Welcome to <span style={{ color: 'var(--primary)' }}>Lexivo</span>
        </h1>
        <p className="text-[var(--text-muted)] text-base leading-relaxed">
          Your personal English vocabulary coach.<br />
          Learn smarter. Remember longer.
        </p>
      </div>

      <div className="w-full max-w-sm space-y-3">
        {[
          { icon: '🃏', text: 'Flashcards + spaced repetition' },
          { icon: '🎯', text: 'Quizzes & pronunciation' },
          { icon: '🇺🇿', text: 'Uzbek translations built in' },
        ].map(({ icon, text }) => (
          <div
            key={text}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm text-left"
            style={{ background: 'var(--surface-2)' }}
          >
            <span className="text-xl">{icon}</span>
            <span className="font-medium text-[var(--text)]">{text}</span>
          </div>
        ))}
      </div>

      <button onClick={onNext} className="btn-primary w-full max-w-sm py-4 text-base font-bold">
        Get Started →
      </button>
    </div>
  );
}

// ── Step 1: Name ─────────────────────────────────────────────────────────────

function StepName({
  name, onChange, onNext, inputRef,
}: {
  name: string;
  onChange: (v: string) => void;
  onNext: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-full px-8 py-12 gap-8">
      <div className="text-6xl">👋</div>

      <div className="text-center">
        <h2 className="text-2xl font-black text-[var(--text)] mb-2">What&apos;s your name?</h2>
        <p className="text-sm text-[var(--text-muted)]">We&apos;ll personalise your experience.</p>
      </div>

      <div className="w-full max-w-sm">
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onNext()}
          placeholder="Your first name"
          maxLength={30}
          className="w-full px-4 py-4 rounded-2xl text-lg font-semibold text-center border-2 border-[var(--border)] bg-[var(--card)] text-[var(--text)] outline-none transition-colors focus:border-[var(--primary)]"
        />
        {name.trim() && (
          <p className="text-center text-sm mt-3 animate-fade-in" style={{ color: 'var(--primary)' }}>
            Nice to meet you, <strong>{name.trim()}</strong>! 🙌
          </p>
        )}
      </div>

      <button onClick={onNext} className="btn-primary w-full max-w-sm py-4 text-base font-bold">
        {name.trim() ? 'Continue →' : 'Skip →'}
      </button>
    </div>
  );
}

// ── Step 2: Level ─────────────────────────────────────────────────────────────

function StepLevel({
  level, onChange, onNext,
}: {
  level: UserSettings['languageLevel'];
  onChange: (v: UserSettings['languageLevel']) => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-col items-center px-5 py-10 gap-6">
      <div className="text-center">
        <div className="text-5xl mb-3">📊</div>
        <h2 className="text-2xl font-black text-[var(--text)] mb-1">Your English level?</h2>
        <p className="text-sm text-[var(--text-muted)]">We&apos;ll recommend the right collections.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
        {LEVELS.map(l => {
          const active = level === l.code;
          return (
            <button
              key={l.code}
              onClick={() => onChange(l.code)}
              className="flex flex-col items-start gap-1 p-4 rounded-2xl border-2 transition-all text-left"
              style={{
                borderColor: active ? l.color : 'var(--border)',
                background: active ? `${l.color}14` : 'var(--card)',
              }}
            >
              <span className="text-xl font-black" style={{ color: l.color }}>{l.code}</span>
              <span className="text-xs font-semibold text-[var(--text)]">{l.name}</span>
              <span className="text-xs text-[var(--text-muted)]">{l.desc}</span>
              {active && (
                <div
                  className="mt-1 w-4 h-4 rounded-full flex items-center justify-center text-white text-xs"
                  style={{ background: l.color }}
                >
                  ✓
                </div>
              )}
            </button>
          );
        })}
      </div>

      <button onClick={onNext} className="btn-primary w-full max-w-sm py-4 text-base font-bold">
        Continue →
      </button>
    </div>
  );
}

// ── Step 3: Daily goal ────────────────────────────────────────────────────────

function StepGoal({
  goal, onChange, name, onFinish,
}: {
  goal: number;
  onChange: (v: number) => void;
  name: string;
  onFinish: () => void;
}) {
  const displayName = name.trim() || 'there';
  return (
    <div className="flex flex-col items-center px-5 py-10 gap-6">
      <div className="text-center">
        <div className="text-5xl mb-3">🎯</div>
        <h2 className="text-2xl font-black text-[var(--text)] mb-1">
          Daily goal, {displayName}?
        </h2>
        <p className="text-sm text-[var(--text-muted)]">You can change this any time in Settings.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
        {GOALS.map(g => {
          const active = goal === g.value;
          return (
            <button
              key={g.value}
              onClick={() => onChange(g.value)}
              className="flex flex-col items-center gap-1.5 p-5 rounded-2xl border-2 transition-all"
              style={{
                borderColor: active ? 'var(--primary)' : 'var(--border)',
                background: active ? 'var(--primary-bg)' : 'var(--card)',
              }}
            >
              <span className="text-3xl">{g.emoji}</span>
              <span className="font-bold text-sm text-[var(--text)]">{g.label}</span>
              <span className="text-xs font-bold" style={{ color: active ? 'var(--primary)' : 'var(--text-muted)' }}>
                {g.value} words
              </span>
              <span className="text-xs text-[var(--text-muted)]">{g.sub}</span>
            </button>
          );
        })}
      </div>

      <button onClick={onFinish} className="btn-primary w-full max-w-sm py-4 text-base font-bold">
        Let&apos;s Go! 🚀
      </button>
    </div>
  );
}

// ── Step 4: Done (shown briefly before redirect) ──────────────────────────────

function StepDone({
  name, level, goal, finishing, onFinish,
}: {
  name: string;
  level: UserSettings['languageLevel'];
  goal: number;
  finishing: boolean;
  onFinish: () => void;
}) {
  const lvl = LEVELS.find(l => l.code === level)!;
  const g = GOALS.find(g => g.value === goal)!;
  const displayName = name.trim() || 'Learner';

  return (
    <div className="flex flex-col items-center justify-center min-h-full px-8 py-12 text-center gap-8">
      <div className="text-7xl animate-bounce">🎉</div>

      <div>
        <h2 className="text-3xl font-black text-[var(--text)] mb-2">You&apos;re all set!</h2>
        <p className="text-[var(--text-muted)]">Here&apos;s your learning profile, {displayName}.</p>
      </div>

      <div className="w-full max-w-sm space-y-2 text-left">
        <SummaryRow icon="👤" label="Name"        value={displayName} />
        <SummaryRow icon="📊" label="Level"       value={`${lvl.code} · ${lvl.name}`} color={lvl.color} />
        <SummaryRow icon={g.emoji} label="Daily goal" value={`${goal} words · ${g.sub}`} />
      </div>

      <button
        onClick={onFinish}
        disabled={finishing}
        className="btn-primary w-full max-w-sm py-4 text-base font-bold disabled:opacity-70"
      >
        {finishing ? 'Loading…' : 'Start Learning →'}
      </button>
    </div>
  );
}

function SummaryRow({
  icon, label, value, color,
}: {
  icon: string; label: string; value: string; color?: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl" style={{ background: 'var(--surface-2)' }}>
      <span className="text-xl">{icon}</span>
      <div className="flex-1">
        <p className="text-xs text-[var(--text-muted)]">{label}</p>
        <p className="text-sm font-semibold" style={{ color: color ?? 'var(--text)' }}>{value}</p>
      </div>
    </div>
  );
}
