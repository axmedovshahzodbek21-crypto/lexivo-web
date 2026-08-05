'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

interface Announcement { id: string; message: string; created_at: string; }
interface Target { id: string; title: string; due_date: string | null; completed_at: string | null; }

type HomeCache = {
  className: string; isTeacher: boolean; teacherName: string;
  announcements: Announcement[]; targets: Target[];
  wordCount: number; memberCount: number; activeToday: number;
  needsAttention: number; readCounts: Record<string, number>;
};
const _homeCache = new Map<string, HomeCache>();

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d}d ago` : `${Math.floor(d / 7)}w ago`;
}

function dueLabel(due: string | null): { text: string; overdue: boolean } | null {
  if (!due) return null;
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (due < today) return { text: `Overdue · ${due}`, overdue: true };
  if (due === today) return { text: 'Due today', overdue: false };
  if (due === tomorrow) return { text: 'Due tomorrow', overdue: false };
  return { text: `Due ${due}`, overdue: false };
}

const CLASS_COLORS = [
  'from-indigo-500 to-indigo-400', 'from-pink-500 to-pink-400',
  'from-emerald-500 to-emerald-400', 'from-blue-500 to-blue-400',
  'from-amber-500 to-amber-400', 'from-purple-500 to-purple-400',
  'from-red-500 to-red-400', 'from-cyan-500 to-cyan-400',
];
function classGradient(id: string) {
  const n = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return CLASS_COLORS[n % CLASS_COLORS.length];
}
const GLOW: Record<string, string> = {
  'from-indigo-500 to-indigo-400': '#6366f1',
  'from-pink-500 to-pink-400': '#ec4899',
  'from-emerald-500 to-emerald-400': '#22c55e',
  'from-blue-500 to-blue-400': '#3b82f6',
  'from-amber-500 to-amber-400': '#f59e0b',
  'from-purple-500 to-purple-400': '#8b5cf6',
  'from-red-500 to-red-400': '#ef4444',
  'from-cyan-500 to-cyan-400': '#06b6d4',
};

export default function ClassHomePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [className, setClassName] = useState('');
  const [isTeacher, setIsTeacher] = useState(false);
  const [teacherName, setTeacherName] = useState('');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [wordCount, setWordCount] = useState(0);
  const [memberCount, setMemberCount] = useState(0);
  const [activeToday, setActiveToday] = useState(0);
  const [needsAttention, setNeedsAttention] = useState(0);
  const [readCounts, setReadCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user) return;
    const cacheKey = `${user.id}:${id}`;
    const cached = _homeCache.get(cacheKey);
    if (cached) {
      setClassName(cached.className);
      setIsTeacher(cached.isTeacher);
      setTeacherName(cached.teacherName);
      setAnnouncements(cached.announcements);
      setTargets(cached.targets);
      setWordCount(cached.wordCount);
      setMemberCount(cached.memberCount);
      setActiveToday(cached.activeToday);
      setNeedsAttention(cached.needsAttention);
      setReadCounts(cached.readCounts);
      setLoading(false);
    } else {
      setLoading(true);
    }

    (async () => {
      const { data: cls } = await supabase
        .from('classes').select('name, teacher_id').eq('id', id).maybeSingle();
      if (!cls) { router.replace('/classes'); return; }

      const teacher = cls.teacher_id === user.id;

      const [{ data: anns }, { data: words }, { data: members }] = await Promise.all([
        supabase.from('class_announcements').select('id, message, created_at')
          .eq('class_id', id).order('created_at', { ascending: false }).limit(5),
        supabase.from('class_words').select('id').eq('class_id', id),
        supabase.from('class_members').select('student_id').eq('class_id', id),
      ]);

      const memberCount = members?.length ?? 0;
      const memberIds = (members ?? []).map((m: { student_id: string }) => m.student_id);
      const annIds = ((anns ?? []) as Announcement[]).map(a => a.id);

      const [{ data: profiles }, { data: reads }, { data: tgts }, { data: tProfile }] = await Promise.all([
        memberCount > 0
          ? supabase.from('profiles').select('last_study_date').in('id', memberIds)
          : Promise.resolve({ data: [] as { last_study_date: string | null }[] }),
        teacher && annIds.length > 0
          ? supabase.from('class_announcement_reads').select('announcement_id').in('announcement_id', annIds)
          : Promise.resolve({ data: [] as { announcement_id: string }[] }),
        !teacher
          ? supabase.from('class_targets').select('id, title, due_date, completed_at, created_at')
              .eq('class_id', id).eq('student_id', user.id).order('created_at', { ascending: false })
          : Promise.resolve({ data: [] as Target[] }),
        !teacher
          ? supabase.from('profiles').select('name').eq('id', cls.teacher_id).maybeSingle()
          : Promise.resolve({ data: null as { name?: string } | null }),
      ]);

      const today = new Date().toISOString().slice(0, 10);
      const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
      const activeToday = (profiles ?? []).filter(p => p.last_study_date === today).length;
      const needsAttention = (profiles ?? []).filter(p => !p.last_study_date || p.last_study_date < threeDaysAgo).length;

      const counts: Record<string, number> = {};
      for (const r of reads ?? []) {
        counts[r.announcement_id] = (counts[r.announcement_id] ?? 0) + 1;
      }

      // Mark announcements read (student side effect — fire and forget)
      if (!teacher && annIds.length > 0) {
        void supabase.from('class_announcement_reads')
          .upsert(annIds.map(aid => ({ announcement_id: aid, student_id: user.id })), { onConflict: 'announcement_id,student_id' });
      }

      const snapshot: HomeCache = {
        className: cls.name, isTeacher: teacher,
        teacherName: (tProfile as { name?: string } | null)?.name ?? 'Teacher',
        announcements: (anns ?? []) as Announcement[],
        targets: (tgts ?? []) as Target[],
        wordCount: words?.length ?? 0, memberCount, activeToday, needsAttention,
        readCounts: counts,
      };
      _homeCache.set(cacheKey, snapshot);

      setClassName(snapshot.className);
      setIsTeacher(snapshot.isTeacher);
      setTeacherName(snapshot.teacherName);
      setAnnouncements(snapshot.announcements);
      setTargets(snapshot.targets);
      setWordCount(snapshot.wordCount);
      setMemberCount(snapshot.memberCount);
      setActiveToday(snapshot.activeToday);
      setNeedsAttention(snapshot.needsAttention);
      setReadCounts(snapshot.readCounts);
      setLoading(false);
    })();
  }, [id, user, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const gradient = classGradient(id);
  const glow = GLOW[gradient] ?? '#6366f1';
  const pending = targets.filter(t => !t.completed_at);

  return (
    <div className="flex flex-col min-h-screen animate-fade-in pb-6">
      {/* Hero */}
      <div
        className={`bg-gradient-to-br ${gradient} px-5 pt-6 pb-8 relative`}
        style={{ boxShadow: `0 8px 32px ${glow}55` }}
      >
        <div className="flex items-start gap-3 mb-4">
          <span className="text-3xl">🏫</span>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black text-white leading-tight truncate">{className}</h1>
            <span className="inline-block text-[10px] font-bold bg-white/25 text-white rounded-full px-2.5 py-0.5 mt-0.5 mb-1">
              {isTeacher ? '👩‍🏫 Teacher' : '🎓 Student'}
            </span>
            <p className="text-sm text-white/75">
              {isTeacher ? `${memberCount} students` : `👩‍🏫 ${teacherName}`}
            </p>
          </div>
          {isTeacher && (
            <button
              onClick={() => router.push(`/classes/${id}`)}
              className="shrink-0 bg-white/20 hover:bg-white/30 transition-colors rounded-xl px-3 py-1.5 text-xs font-bold text-white"
            >
              Dashboard →
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {[
            `📖 ${wordCount} words`,
            `✅ ${activeToday}/${memberCount} active`,
            ...(!isTeacher ? [`📋 ${pending.length} pending`] : []),
          ].map(label => (
            <span key={label} className="text-xs font-semibold bg-black/20 text-white rounded-full px-3 py-1">
              {label}
            </span>
          ))}
        </div>
        {memberCount > 0 && (
          <div>
            <div className="flex justify-between text-xs text-white/80 mb-1.5">
              <span className="font-semibold">
                {activeToday >= memberCount ? '🔥 Everyone\'s active today!' : '🔥 Class Activity'}
              </span>
              <span>{activeToday} of {memberCount}</span>
            </div>
            <div className="h-1.5 bg-white/25 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-700"
                style={{ width: `${memberCount > 0 ? (activeToday / memberCount) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 p-4 space-y-5">

        {/* Spotlight banner (teacher only) */}
        {isTeacher && needsAttention > 0 && (
          <button
            onClick={() => router.push(`/classes/${id}`)}
            className="w-full text-left p-4 rounded-2xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <span className="text-xl">⚠️</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-red-600 dark:text-red-400">
                {needsAttention} student{needsAttention > 1 ? 's' : ''} need attention
              </p>
              <p className="text-xs text-[var(--text-muted)]">Haven't studied in 3+ days · Tap to open Dashboard</p>
            </div>
            <span className="text-red-500 text-sm shrink-0">→</span>
          </button>
        )}

        {/* Homework (student) */}
        {!isTeacher && targets.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3">📋 Homework</h2>
            <div className="space-y-2">
              {targets.slice(0, 3).map(t => {
                const due = dueLabel(t.due_date);
                const done = !!t.completed_at;
                return (
                  <div key={t.id} className={`flex items-start gap-3 p-3 rounded-xl border ${done ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800' : 'bg-[var(--surface)] border-[var(--border)]'}`}>
                    <span className="text-lg mt-0.5">{done ? '✅' : '⏳'}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${done ? 'line-through text-green-600 dark:text-green-400' : 'text-[var(--text)]'}`}>{t.title}</p>
                      {due && <p className={`text-xs mt-0.5 ${due.overdue ? 'text-red-500 font-bold' : 'text-[var(--text-muted)]'}`}>{due.text}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Quick stats (teacher) */}
        {isTeacher && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3">📊 Quick Stats</h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: '👥', value: memberCount, label: 'Students' },
                { icon: '✅', value: activeToday, label: 'Active today' },
                { icon: '📖', value: wordCount, label: 'Words' },
              ].map(({ icon, value, label }) => (
                <div key={label} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 flex flex-col items-center gap-1">
                  <span className="text-xl">{icon}</span>
                  <span className="text-xl font-black text-[var(--text)]">{value}</span>
                  <span className="text-[10px] text-[var(--text-muted)] font-medium">{label}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Announcements */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3">📢 Announcements</h2>
          {announcements.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] text-center py-6">No announcements yet</p>
          ) : (
            <div className="space-y-2">
              {announcements.map(a => {
                const isNew = Date.now() - new Date(a.created_at).getTime() < 86400000;
                return (
                  <div key={a.id} className={`p-3 rounded-xl border flex gap-3 ${isNew ? 'bg-[var(--primary-bg)] border-l-4 border-l-[var(--primary)] border-[var(--border)]' : 'bg-[var(--surface)] border-[var(--border)]'}`}>
                    <span className="text-base mt-0.5">📢</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--text)]">{a.message}</p>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">{timeAgo(a.created_at)}</p>
                    </div>
                    {isTeacher
                      ? <span className="text-[9px] font-bold text-[var(--text-muted)] self-start pt-0.5 bg-[var(--surface-2)] px-1.5 py-0.5 rounded-md shrink-0">{readCounts[a.id] ?? 0}/{memberCount}</span>
                      : isNew && <span className="text-[10px] font-bold text-[var(--primary)] self-start pt-0.5">NEW</span>
                    }
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
