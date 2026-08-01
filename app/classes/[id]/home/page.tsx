'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

interface Announcement { id: string; message: string; created_at: string; }
interface Target { id: string; title: string; due_date: string | null; completed_at: string | null; }

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

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);

      const { data: cls } = await supabase
        .from('classes')
        .select('name, teacher_id')
        .eq('id', id)
        .maybeSingle();
      if (!cls) { router.replace('/classes'); return; }

      const teacher = cls.teacher_id === user.id;
      setClassName(cls.name);
      setIsTeacher(teacher);

      const [{ data: anns }, { data: words }] = await Promise.all([
        supabase.from('class_announcements').select('id, message, created_at')
          .eq('class_id', id).order('created_at', { ascending: false }).limit(5),
        supabase.from('class_words').select('id').eq('class_id', id),
      ]);
      setAnnouncements(anns ?? []);
      setWordCount(words?.length ?? 0);

      const { data: members } = await supabase
        .from('class_members').select('student_id').eq('class_id', id);
      const count = members?.length ?? 0;
      setMemberCount(count);
      if (count > 0) {
        const today = new Date().toISOString().slice(0, 10);
        const ids = (members ?? []).map((m: { student_id: string }) => m.student_id);
        const { data: profiles } = await supabase
          .from('profiles').select('last_study_date').in('id', ids);
        setActiveToday(profiles?.filter(p => p.last_study_date === today).length ?? 0);
      }

      if (!teacher) {
        const [{ data: tgts }, { data: profile }] = await Promise.all([
          supabase.from('class_targets').select('id, title, due_date, completed_at, created_at')
            .eq('class_id', id).eq('student_id', user.id).order('created_at', { ascending: false }),
          supabase.from('profiles').select('name').eq('id', cls.teacher_id).maybeSingle(),
        ]);
        setTargets(tgts ?? []);
        setTeacherName((profile as { name?: string } | null)?.name ?? 'Teacher');
      }

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
            <p className="text-sm text-white/75">
              {isTeacher ? `${memberCount} students` : `👩‍🏫 ${teacherName}`}
            </p>
          </div>
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
                    {isNew && <span className="text-[10px] font-bold text-[var(--primary)] self-start pt-0.5">NEW</span>}
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
