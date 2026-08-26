'use client';
import { useEffect, useState } from 'react';
import { saveSettings } from '@/lib/storage';
import { useTranslation } from '@/lib/useTranslation';
import type { UserSettings } from '@/lib/types';

interface Props {
  settings: UserSettings;
  todayCount: number;
  onSave: (goal: number) => void;
  onClose: () => void;
}

export default function DailyGoalModal({ settings, todayCount, onSave, onClose }: Props) {
  const t = useTranslation();
  const [goal, setGoal] = useState(settings.dailyGoal);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const progress = Math.min((todayCount / Math.max(goal, 1)) * 100, 100);

  const save = () => {
    const clamped = Math.max(1, Math.min(100, goal || 10));
    saveSettings({ ...settings, dailyGoal: clamped });
    onSave(clamped);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative w-full max-w-sm rounded-t-3xl shadow-2xl animate-slide-up flex flex-col"
        style={{ maxHeight: '90vh', background: 'var(--surface)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
        </div>

        <div className="px-6 pb-6 space-y-5 overflow-y-auto overscroll-contain">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t.home.dailyGoal}</p>
            <h3 className="text-2xl font-black mt-0.5" style={{ color: 'var(--text)' }}>🎯 {t.home.dailyGoal}</h3>
          </div>

          {/* Today's progress */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--primary-bg)' }}>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-3xl font-black" style={{ color: 'var(--primary)' }}>{todayCount} / {goal}</span>
              <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>words today</span>
            </div>
            <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: 'var(--primary)' }} />
            </div>
          </div>

          {/* Customize goal */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide block mb-2" style={{ color: 'var(--text-muted)' }}>
              New words per day
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setGoal(g => Math.max(1, g - 1))}
                className="w-11 h-11 rounded-xl text-lg font-bold shrink-0"
                style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
              >−</button>
              <input
                type="number"
                min={1}
                max={100}
                value={goal}
                onChange={e => setGoal(parseInt(e.target.value) || 1)}
                className="flex-1 text-center px-4 py-3 rounded-xl bg-[var(--surface-2)] border-2 border-transparent focus:border-[var(--primary)] outline-none transition-colors text-lg font-black"
                style={{ color: 'var(--text)' }}
              />
              <button
                onClick={() => setGoal(g => Math.min(100, g + 1))}
                className="w-11 h-11 rounded-xl text-lg font-bold shrink-0"
                style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
              >+</button>
            </div>
          </div>

          <button
            onClick={save}
            className="w-full py-3 rounded-xl text-sm font-bold text-white"
            style={{ background: 'var(--primary)' }}
          >
            {t.common.save}
          </button>
        </div>
      </div>
    </div>
  );
}
