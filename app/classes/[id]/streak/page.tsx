'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

const CLASS_ACCENT_COLORS = [
  '#6366f1', '#ec4899', '#22c55e', '#3b82f6',
  '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4',
];
function classAccentColor(id: string) {
  const n = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return CLASS_ACCENT_COLORS[n % CLASS_ACCENT_COLORS.length];
}

function dateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function calcCurrentStreak(days: string[]): number {
  if (!days.length) return 0;
  const set = new Set(days);
  // 2-hour offset so midnight doesn't reset streak prematurely
  const now = new Date(Date.now() - 2 * 3_600_000);
  const today = dateStr(now);
  const yesterday = dateStr(new Date(now.getTime() - 86_400_000));
  if (!set.has(today) && !set.has(yesterday)) return 0;
  let cursor = set.has(today) ? now : new Date(now.getTime() - 86_400_000);
  let streak = 0;
  while (set.has(dateStr(cursor))) {
    streak++;
    cursor = new Date(cursor.getTime() - 86_400_000);
  }
  return streak;
}

function calcLongestStreak(days: string[]): number {
  if (!days.length) return 0;
  let longest = 0, current = 0, prev = '';
  for (const d of days) {
    if (prev) {
      const diff = Math.round((new Date(d).getTime() - new Date(prev).getTime()) / 86_400_000);
      current = diff === 1 ? current + 1 : 1;
    } else {
      current = 1;
    }
    if (current > longest) longest = current;
    prev = d;
  }
  return longest;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function ClassStreakPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const viewUserId = searchParams.get('userId');
  const viewUserName = searchParams.get('userName');
  const targetUserId = viewUserId || user?.id;

  const [loading, setLoading] = useState(true);
  const [className, setClassName] = useState('');
  const [studyDays, setStudyDays] = useState<string[]>([]);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [totalDays, setTotalDays] = useState(0);
  const [month, setMonth] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });

  const accent = classAccentColor(id);

  useEffect(() => {
    if (!targetUserId) return;
    (async () => {
      const [{ data: cls }, { data: rows }] = await Promise.all([
        supabase.from('classes').select('name').eq('id', id).maybeSingle(),
        supabase
          .from('class_study_days')
          .select('study_date')
          .eq('student_id', targetUserId)
          .eq('class_id', id),
      ]);
      setClassName(cls?.name ?? '');
      const days = ((rows ?? []) as { study_date: string }[])
        .map(r => r.study_date)
        .sort();
      setStudyDays(days);
      setCurrentStreak(calcCurrentStreak(days));
      setLongestStreak(calcLongestStreak(days));
      setTotalDays(days.length);
      setLoading(false);
    })();
  }, [id, targetUserId]);

  if (!user) return null;

  const now = new Date();
  const todayStr = dateStr(now);
  const set = new Set(studyDays);
  const studiedToday = set.has(todayStr);

  const title = viewUserName ? `${viewUserName} · ${className}` : `${className} Streak`;

  const year = month.getFullYear();
  const m = month.getMonth();
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, m, 1).getDay();
  const offset = (firstDayOfWeek + 6) % 7; // convert Sun=0 → Mon-first
  const mm = String(m + 1).padStart(2, '0');
  const canNext = !(year === now.getFullYear() && m === now.getMonth());

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-4">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors text-lg font-semibold"
        >
          ←
        </button>
        <div className="min-w-0">
          <h1 className="text-base font-black text-[var(--text)] leading-tight truncate">{title}</h1>
          <p className="text-xs text-[var(--text-muted)]">
            {viewUserName ? 'Class streak calendar' : 'Your class streak'}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center pt-20">
          <div
            className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: accent }}
          />
        </div>
      ) : (
        <div className="px-4 space-y-4">
          {/* Stat tiles */}
          <div className="grid grid-cols-3 gap-3">
            {([
              { emoji: '🔥', value: currentStreak, label: 'Current streak', color: accent },
              { emoji: '⚡', value: longestStreak, label: 'Longest streak', color: '#0369a1' },
              { emoji: '🏆', value: totalDays, label: 'Total days', color: '#b45309' },
            ] as const).map(({ emoji, value, label, color }) => (
              <div
                key={label}
                className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-3 flex flex-col items-center gap-1"
              >
                <span className="text-xl">{emoji}</span>
                <span className="text-xl font-black" style={{ color }}>{value}</span>
                <span className="text-[10px] text-[var(--text-muted)] text-center leading-tight">{label}</span>
              </div>
            ))}
          </div>

          {/* Today status */}
          <div
            className="rounded-2xl p-4 border flex items-center gap-3"
            style={{
              background: studiedToday ? `color-mix(in srgb, ${accent} 12%, transparent)` : 'var(--surface)',
              borderColor: studiedToday ? `color-mix(in srgb, ${accent} 40%, transparent)` : 'var(--border)',
            }}
          >
            <span className="text-2xl">{studiedToday ? '✅' : '⏳'}</span>
            <div>
              <p className="text-sm font-bold text-[var(--text)]">Today</p>
              <p className="text-xs text-[var(--text-muted)]">
                {studiedToday
                  ? (viewUserName
                    ? `${viewUserName} studied ${className} today`
                    : `You studied ${className} today`)
                  : (viewUserName
                    ? `${viewUserName} hasn't studied today`
                    : `Study anything in ${className} to keep your streak`)}
              </p>
            </div>
          </div>

          {/* Calendar */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
            {/* Month nav */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setMonth(new Date(year, m - 1, 1))}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--surface-2)] transition-colors text-lg text-[var(--text)]"
              >
                ‹
              </button>
              <span className="text-sm font-bold text-[var(--text)]">
                {MONTH_NAMES[m]} {year}
              </span>
              <button
                onClick={() => canNext && setMonth(new Date(year, m + 1, 1))}
                disabled={!canNext}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--surface-2)] transition-colors disabled:opacity-30 text-lg text-[var(--text)]"
              >
                ›
              </button>
            </div>

            {/* Day labels (Mon-first) */}
            <div className="grid grid-cols-7 mb-1">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                <span
                  key={i}
                  className="text-[11px] font-bold text-[var(--text-muted)] text-center py-1"
                >
                  {d}
                </span>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 gap-y-1">
              {Array.from({ length: offset }).map((_, i) => (
                <div key={`e-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                const dStr = `${year}-${mm}-${String(day).padStart(2, '0')}`;
                const isToday = dStr === todayStr;
                const isFuture = dStr > todayStr;
                const studied = set.has(dStr);
                return (
                  <div key={day} className="flex items-center justify-center aspect-square">
                    <div
                      className="w-8 h-8 flex items-center justify-center rounded-full text-[12px] transition-all"
                      style={{
                        background: studied ? accent : 'transparent',
                        color: studied ? 'white' : 'var(--text)',
                        opacity: isFuture ? 0.25 : 1,
                        outline: isToday && !studied ? `1.5px solid ${accent}` : 'none',
                        fontWeight: isToday ? 700 : 400,
                      }}
                    >
                      {day}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-2 mt-3">
              <div className="w-3 h-3 rounded-full" style={{ background: accent }} />
              <span className="text-[11px] text-[var(--text-muted)]">Studied in class</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
