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
        supabase.from('class_study_days').select('study_date')
          .eq('student_id', targetUserId).eq('class_id', id),
      ]);
      setClassName(cls?.name ?? '');
      const days = ((rows ?? []) as { study_date: string }[]).map(r => r.study_date).sort();
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

  const year = month.getFullYear();
  const m = month.getMonth();
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, m, 1).getDay();
  const offset = (firstDayOfWeek + 6) % 7;
  const mm = String(m + 1).padStart(2, '0');
  const canNext = !(year === now.getFullYear() && m === now.getMonth());

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-12">

      {/* ── Hero ── */}
      <div
        className="relative px-5 pt-5 pb-10"
        style={{
          background: `linear-gradient(135deg, ${accent} 0%, ${accent}bb 100%)`,
          boxShadow: `0 8px 32px ${accent}44`,
        }}
      >
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-xl mb-5 text-white/80 hover:text-white hover:bg-white/15 transition-colors text-lg font-semibold"
        >
          ←
        </button>

        {/* Streak number */}
        <div className="text-center">
          <div className="text-7xl font-black text-white leading-none mb-1">
            {loading ? '–' : currentStreak}
          </div>
          <div className="text-white/70 text-sm font-semibold mb-0.5">
            {currentStreak === 1 ? 'day streak' : 'day streak'} 🔥
          </div>
          <div className="text-white font-black text-lg">
            {viewUserName ?? className}
          </div>
          {viewUserName && (
            <div className="text-white/60 text-xs mt-0.5">{className}</div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center pt-16">
          <div className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: accent }} />
        </div>
      ) : (
        <div className="px-4 space-y-4">

          {/* ── Stat cards (float out of hero) ── */}
          <div className="grid grid-cols-3 gap-3 -mt-5">
            {([
              { emoji: '🔥', value: currentStreak, label: 'Current', color: accent },
              { emoji: '⚡', value: longestStreak, label: 'Longest', color: '#0ea5e9' },
              { emoji: '🏆', value: totalDays,     label: 'Total days', color: '#f59e0b' },
            ] as const).map(({ emoji, value, label, color }) => (
              <div
                key={label}
                className="bg-[var(--surface)] rounded-2xl p-3 flex flex-col items-center gap-1"
                style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}
              >
                <span className="text-lg">{emoji}</span>
                <span className="text-2xl font-black leading-none" style={{ color }}>{value}</span>
                <span className="text-[10px] text-[var(--text-muted)] font-medium">{label}</span>
              </div>
            ))}
          </div>

          {/* ── Today status ── */}
          <div
            className="rounded-2xl px-4 py-3 flex items-center gap-3 border"
            style={{
              background: studiedToday ? `color-mix(in srgb, ${accent} 10%, var(--surface))` : 'var(--surface)',
              borderColor: studiedToday ? `color-mix(in srgb, ${accent} 35%, transparent)` : 'var(--border)',
            }}
          >
            <span className="text-xl shrink-0">{studiedToday ? '✅' : '⏳'}</span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[var(--text)]">Today</p>
              <p className="text-xs text-[var(--text-muted)] leading-snug">
                {studiedToday
                  ? (viewUserName ? `${viewUserName} studied ${className} today` : `You studied ${className} today`)
                  : (viewUserName ? `${viewUserName} hasn't studied today` : `Study anything in ${className} to keep your streak`)}
              </p>
            </div>
            {studiedToday && (
              <span
                className="ml-auto shrink-0 text-xs font-bold px-2.5 py-1 rounded-full"
                style={{ background: `color-mix(in srgb, ${accent} 20%, transparent)`, color: accent }}
              >
                Done!
              </span>
            )}
          </div>

          {/* ── Calendar ── */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
            {/* Month nav */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <button
                onClick={() => setMonth(new Date(year, m - 1, 1))}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--surface-2)] transition-colors text-[var(--text)] text-lg"
              >
                ‹
              </button>
              <span className="text-sm font-bold text-[var(--text)]">{MONTH_NAMES[m]} {year}</span>
              <button
                onClick={() => canNext && setMonth(new Date(year, m + 1, 1))}
                disabled={!canNext}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--surface-2)] transition-colors disabled:opacity-25 text-[var(--text)] text-lg"
              >
                ›
              </button>
            </div>

            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 px-2 pb-1">
              {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d, i) => (
                <div key={i} className="text-center text-[10px] font-bold text-[var(--text-muted)] py-1">{d}</div>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 px-2 pb-3 gap-y-0.5">
              {Array.from({ length: offset }).map((_, i) => <div key={`e-${i}`} />)}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                const dStr = `${year}-${mm}-${String(day).padStart(2, '0')}`;
                const isToday = dStr === todayStr;
                const isFuture = dStr > todayStr;
                const studied = set.has(dStr);
                return (
                  <div key={day} className="aspect-square flex items-center justify-center">
                    <div
                      className="w-8 h-8 flex items-center justify-center rounded-full text-xs font-medium transition-all select-none"
                      style={{
                        background: studied ? accent : isToday ? `color-mix(in srgb, ${accent} 15%, transparent)` : 'transparent',
                        color: studied ? '#fff' : isToday ? accent : 'var(--text)',
                        opacity: isFuture ? 0.22 : 1,
                        fontWeight: isToday || studied ? 700 : 400,
                        outline: isToday && !studied ? `2px solid ${accent}` : 'none',
                        outlineOffset: '-1px',
                      }}
                    >
                      {day}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div
              className="flex items-center justify-center gap-4 py-3 border-t border-[var(--border)]"
            >
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ background: accent }} />
                <span className="text-[11px] text-[var(--text-muted)]">Studied</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div
                  className="w-3 h-3 rounded-full border-2"
                  style={{ borderColor: accent, background: `color-mix(in srgb, ${accent} 15%, transparent)` }}
                />
                <span className="text-[11px] text-[var(--text-muted)]">Today</span>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
