'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { localDateStr } from '@/lib/storage';

const CLASS_ACCENT_COLORS = [
  '#6366f1', '#ec4899', '#22c55e', '#3b82f6',
  '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4',
];
function classAccentColor(id: string) {
  const n = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return CLASS_ACCENT_COLORS[n % CLASS_ACCENT_COLORS.length];
}

function calcCurrentStreak(days: string[]): number {
  if (!days.length) return 0;
  const set = new Set(days);
  // Plain local midnight, matching localDateStr() everywhere else this app
  // computes a day boundary (personal streaks, study days) — this used to
  // apply a bespoke -2hr offset found nowhere else in the codebase, which
  // let this page's streak silently disagree with the "today" ring drawn
  // just below it in the same file (computed with no offset) and with the
  // streak shown on the class dashboard/leaderboard.
  const now = new Date();
  const today = localDateStr(now);
  const yesterday = localDateStr(new Date(now.getTime() - 86_400_000));
  if (!set.has(today) && !set.has(yesterday)) return 0;
  let cursor = set.has(today) ? now : new Date(now.getTime() - 86_400_000);
  let streak = 0;
  while (set.has(localDateStr(cursor))) {
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

function buildMonthGrid(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const offset = (firstDay + 6) % 7; // Mon-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
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
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());

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
  const todayStr = localDateStr(now);
  const studiedSet = new Set(studyDays);

  const monthName = `${MONTH_NAMES[viewMonth]} ${viewYear}`;
  const cells = buildMonthGrid(viewYear, viewMonth);
  const canGoNext = viewYear < now.getFullYear() || (viewYear === now.getFullYear() && viewMonth < now.getMonth());
  const mm = String(viewMonth + 1).padStart(2, '0');

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (!canGoNext) return;
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  const title = viewUserName ? `${viewUserName} · ${className}` : `${className} Streak`;

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-12">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-4">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors text-lg font-semibold shrink-0"
        >
          ←
        </button>
        <div className="min-w-0">
          <h1 className="text-base font-black text-[var(--text)] leading-tight truncate">{title}</h1>
          <p className="text-xs text-[var(--text-muted)]">{viewUserName ? 'Class streak calendar' : 'Your class streak'}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center pt-20">
          <div className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: accent }} />
        </div>
      ) : (
        <div className="px-4 space-y-4">

          {/* ── Stat tiles ── */}
          <div className="grid grid-cols-3 gap-3">
            {([
              { emoji: '🔥', value: currentStreak, label: 'Current Streak', bg: '#be123c', shadow: '#881337' },
              { emoji: '⚡', value: longestStreak,  label: 'Longest streak',  bg: '#0369a1', shadow: '#0c4a6e' },
              { emoji: '🏆', value: totalDays,      label: 'Full days',       bg: '#b45309', shadow: '#78350f' },
            ] as const).map(({ emoji, value, label, bg, shadow }) => (
              <div
                key={label}
                className="rounded-2xl p-3 flex flex-col gap-1"
                style={{ background: bg, boxShadow: `0 3px 0 ${shadow}` }}
              >
                <span className="text-xl">{emoji}</span>
                <div className="text-2xl font-black text-white leading-tight">{value}</div>
                <div className="text-[10px] text-white/70 font-semibold leading-tight">{label}</div>
              </div>
            ))}
          </div>

          {/* ── Calendar ── */}
          <div className="card">
            {/* Month nav */}
            <div className="flex items-center justify-between mb-5">
              <button
                onClick={prevMonth}
                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[var(--surface-2)] transition-colors text-[var(--text)] text-xl font-bold"
              >‹</button>
              <span className="font-bold text-[var(--text)]">{monthName}</span>
              <button
                onClick={nextMonth}
                disabled={!canGoNext}
                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[var(--surface-2)] transition-colors text-[var(--text)] text-xl font-bold disabled:opacity-30"
              >›</button>
            </div>

            <div className="max-w-[308px] mx-auto">
              {/* Day headers */}
              <div className="grid grid-cols-7 mb-1">
                {DAY_LABELS.map(d => (
                  <div key={d} className="w-10 h-7 flex items-center justify-center text-[10px] font-bold text-[var(--text-muted)]">{d}</div>
                ))}
              </div>

              {/* Day circles */}
              <div className="grid grid-cols-7 gap-y-1.5">
                {cells.map((day, i) => {
                  if (!day) return <div key={i} className="w-10 h-10" />;
                  const dStr = `${viewYear}-${mm}-${String(day).padStart(2, '0')}`;
                  const isToday = dStr === todayStr;
                  const isFuture = dStr > todayStr;
                  const studied = studiedSet.has(dStr);
                  return (
                    <div
                      key={dStr}
                      className="w-10 h-10 rounded-full relative overflow-hidden flex items-center justify-center"
                      style={{
                        background: studied ? accent : 'transparent',
                        outline: isToday ? '2.5px solid #6366f1' : 'none',
                        outlineOffset: '2px',
                        opacity: isFuture ? 0.2 : 1,
                      }}
                    >
                      <span
                        className="relative z-10 text-xs font-bold leading-none"
                        style={{ color: studied ? '#fff' : isToday ? 'var(--text)' : 'var(--text-muted)' }}
                      >
                        {day}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-5 pt-3 border-t border-[var(--border)]">
              <div className="flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 rounded-full" style={{ background: accent }} />
                <span className="text-[10px] text-[var(--text-muted)]">Studied in class</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 rounded-full border-2 border-[#6366f1]" />
                <span className="text-[10px] text-[var(--text-muted)]">Today</span>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
