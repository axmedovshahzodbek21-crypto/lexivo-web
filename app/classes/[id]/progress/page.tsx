'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { getClassSRSAll, getClassStarredWordIds, getClassHardWordIds } from '@/lib/class-srs';
import type { ClassSRSEntry } from '@/lib/class-srs';
import { localDateStr, addDaysToDateStr } from '@/lib/storage';

const STAGE_COLORS = ['#9CA3AF', '#F59E0B', '#3B82F6', '#8B5CF6', '#EC4899', '#10B981'];
const STAGE_LABELS = ['New', '+1 day', '+3 days', '+7 days', '+14 days', 'Graduated'];

function todayStr() {
  return localDateStr();
}

function last30Days(): string[] {
  const today = todayStr();
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) days.push(addDaysToDateStr(today, -i));
  return days;
}

export default function ProgressPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [className, setClassName] = useState('');
  const [entries, setEntries] = useState<ClassSRSEntry[]>([]);
  const [starredCount, setStarredCount] = useState(0);
  const [hardCount, setHardCount] = useState(0);
  const [totalWords, setTotalWords] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: cls }, all, starred, hard, { count }] = await Promise.all([
        supabase.from('classes').select('name').eq('id', id).single(),
        getClassSRSAll(user.id, id),
        getClassStarredWordIds(user.id, id),
        getClassHardWordIds(user.id, id),
        supabase.from('class_words').select('id', { count: 'exact', head: true }).eq('class_id', id),
      ]);
      setClassName((cls as { name: string } | null)?.name ?? '');
      setEntries(all);
      setStarredCount(starred.size);
      setHardCount(hard.size);
      setTotalWords(count ?? 0);
      setLoading(false);
    })();
  }, [user, id]);

  const stageCounts = Array.from({ length: 6 }, (_, s) => entries.filter(e => e.stage === s).length);
  const learnedCount = entries.length;
  const dueCount = entries.filter(e => e.next_due <= todayStr() && e.stage < 5).length;

  // Calendar: set of dates with any review activity. last_reviewed comes
  // back from Supabase as a UTC timestamp — slicing the string directly (as
  // before) read the UTC calendar date, not the local one, so a late-night
  // review could land on the wrong day cell in the local-dated 30-day
  // calendar below. Parsing through localDateStr() fixes that.
  const reviewDates = new Set(
    entries.map(e => e.last_reviewed ? localDateStr(new Date(e.last_reviewed)) : null).filter(Boolean) as string[],
  );
  const days = last30Days();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const _n = (id as string).split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
  const _grad = ['from-indigo-500 to-purple-500','from-pink-500 to-rose-400','from-emerald-500 to-teal-400','from-blue-500 to-cyan-400','from-amber-500 to-orange-400','from-violet-500 to-purple-400','from-red-500 to-pink-400','from-cyan-500 to-blue-400'][_n % 8];
  const _glow = ['#818cf8','#ec4899','#22c55e','#3b82f6','#f59e0b','#8b5cf6','#ef4444','#06b6d4'][_n % 8];

  return (
    <div className="flex flex-col min-h-screen pb-8">
      <div className={`bg-gradient-to-br ${_grad} px-5 pt-5 pb-7 relative`}
        style={{ boxShadow: `0 8px 32px ${_glow}cc` }}>
        <div style={{ position: 'absolute', right: 16, top: 8, fontSize: 80, fontWeight: 900, color: 'rgba(255,255,255,0.06)', lineHeight: 1, userSelect: 'none', pointerEvents: 'none' }}>📊</div>
        <button onClick={() => router.push(`/classes/${id}/home`)} className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-sm font-medium mb-4 transition-colors">← Back</button>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
            style={{ background: 'rgba(255,255,255,0.18)', boxShadow: '0 4px 0 rgba(0,0,0,0.15)' }}>📊</div>
          <div>
            <p className="text-xs font-black text-white/50 uppercase tracking-widest mb-0.5">{className || '...'}</p>
            <h1 className="text-2xl font-black text-white leading-tight" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.25)' }}>My Progress</h1>
            <p className="text-sm text-white/60 mt-1">Your personal study stats</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto w-full">
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: `${learnedCount}/${totalWords}`, label: 'Learned', color: 'var(--primary)' },
            { value: dueCount,                        label: 'Due today', color: dueCount > 0 ? '#f59e0b' : '#10B981' },
            { value: starredCount,                    label: 'Starred',   color: '#f59e0b' },
          ].map(({ value, label, color }) => (
            <div key={label} className="card text-center py-3 space-y-0.5">
              <p className="text-2xl font-bold" style={{ color }}>{value}</p>
              <p className="text-[10px] text-[var(--text-muted)] font-medium uppercase tracking-wide">{label}</p>
            </div>
          ))}
        </div>

        {/* SRS Stage breakdown */}
        <div className="card space-y-3">
          <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">SRS Stages</p>
          {stageCounts.map((count, s) => (
            <div key={s} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: STAGE_COLORS[s] }} />
                  <span className="text-[var(--text)] font-medium">{STAGE_LABELS[s]}</span>
                </div>
                <span className="text-[var(--text-muted)]">{count} word{count !== 1 ? 's' : ''}</span>
              </div>
              <div className="h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: learnedCount > 0 ? `${(count / learnedCount) * 100}%` : '0%',
                    background: STAGE_COLORS[s],
                  }}
                />
              </div>
            </div>
          ))}
          {learnedCount === 0 && (
            <p className="text-xs text-[var(--text-muted)] text-center py-2">Start studying to see your SRS progress.</p>
          )}
        </div>

        {/* Hard words */}
        {hardCount > 0 && (
          <div className="card flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm text-[var(--text)]">Hard words</p>
              <p className="text-xs text-[var(--text-muted)]">Words you got wrong in quizzes</p>
            </div>
            <span className="text-xl font-bold text-[var(--danger)]">{hardCount}</span>
          </div>
        )}

        {/* 30-day study calendar */}
        <div className="card space-y-3">
          <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">Study Calendar · Last 30 days</p>
          <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(10, 1fr)' }}>
            {days.map(day => {
              const studied = reviewDates.has(day);
              const isToday = day === todayStr();
              return (
                <div
                  key={day}
                  title={day}
                  className="aspect-square rounded-md"
                  style={{
                    background: studied
                      ? 'var(--primary)'
                      : 'var(--surface-2)',
                    outline: isToday ? '2px solid var(--primary)' : 'none',
                    outlineOffset: '1px',
                    opacity: studied ? 1 : 0.5,
                  }}
                />
              );
            })}
          </div>
          <div className="flex items-center justify-end gap-2 text-[10px] text-[var(--text-muted)]">
            <span className="w-3 h-3 rounded-sm inline-block bg-[var(--surface-2)] opacity-50" /> No study
            <span className="w-3 h-3 rounded-sm inline-block bg-[var(--primary)]" /> Studied
          </div>
        </div>

        {/* CTA — review if due */}
        {dueCount > 0 && (
          <button
            onClick={() => router.push(`/classes/${id}/review`)}
            className="w-full btn-primary py-4"
          >
            Review {dueCount} due word{dueCount !== 1 ? 's' : ''} →
          </button>
        )}
      </div>
    </div>
  );
}
