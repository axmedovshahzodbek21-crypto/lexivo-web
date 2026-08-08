'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

interface Announcement { id: string; message: string; created_at: string; }
interface Target { id: string; title: string; due_date: string | null; completed_at: string | null; }
interface StudentProfile {
  id: string; name: string; avatar_url: string | null;
  xp: number; streak: number; last_study_date: string | null; total_learned: number;
}

type HomeCache = {
  className: string; isTeacher: boolean; teacherName: string; teacherId: string; teacherBio: string;
  announcements: Announcement[]; targets: Target[];
  wordCount: number; memberCount: number; activeToday: number;
  needsAttention: number; readCounts: Record<string, number>;
};

const AVATAR_PALETTE = ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899','#3b82f6'];
function avatarColor(userId: string): string {
  const hash = userId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}
const _homeCache = new Map<string, HomeCache>();

const XP_REASON_ICON: Record<string, string> = { Learn: '📖', Cards: '🃏', Quiz: '🧠', Match: '🎯', 'SRS Review': '🔄' };
function XpHistoryRow({ entry }: { entry: { amount: number; reason: string; created_at: string } }) {
  const icon = XP_REASON_ICON[entry.reason] ?? '⚡';
  const diff = Date.now() - new Date(entry.created_at).getTime();
  const m = Math.floor(diff / 60000);
  const ago = m < 1 ? 'just now' : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.floor(m / 60)}h ago` : m < 10080 ? `${Math.floor(m / 1440)}d ago` : new Date(entry.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[var(--surface-2)]">
      <span className="text-xl shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--text)]">{entry.reason}</p>
        <p className="text-[11px] text-[var(--text-muted)]">{ago}</p>
      </div>
      <p className="text-sm font-black shrink-0" style={{ color: 'var(--primary)' }}>+{(entry.amount / 10).toFixed(1)}</p>
    </div>
  );
}

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
  const [teacherId, setTeacherId] = useState('');
  const [teacherBio, setTeacherBio] = useState('');
  const [showTeacherBio, setShowTeacherBio] = useState(false);
  const [showHW, setShowHW] = useState(false);
  const [showStudents, setShowStudents] = useState(false);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState('');
  const [xpHistoryStudent, setXpHistoryStudent] = useState<StudentProfile | null>(null);
  const [teacherXpHistory, setTeacherXpHistory] = useState<{ id: string; amount: number; reason: string; created_at: string }[]>([]);
  const [teacherXpHistoryLoading, setTeacherXpHistoryLoading] = useState(false);
  const [myXpHistory, setMyXpHistory] = useState<{ id: string; amount: number; reason: string; created_at: string }[]>([]);
  const [myXpHistoryLoading, setMyXpHistoryLoading] = useState(false);
  const [myXpHistoryLoaded, setMyXpHistoryLoaded] = useState(false);
  const [pendingHwCount, setPendingHwCount] = useState(0);
  const memberIdsRef = useRef<string[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [wordCount, setWordCount] = useState(0);
  const [memberCount, setMemberCount] = useState(0);
  const [activeToday, setActiveToday] = useState(0);
  const [needsAttention, setNeedsAttention] = useState(0);
  const [readCounts, setReadCounts] = useState<Record<string, number>>({});
  const [myClassXp, setMyClassXp] = useState(0);

  useEffect(() => {
    if (!user) return;
    const cacheKey = `${user.id}:${id}`;
    const cached = _homeCache.get(cacheKey);
    if (cached) {
      setClassName(cached.className);
      setIsTeacher(cached.isTeacher);
      setTeacherName(cached.teacherName);
      setTeacherId(cached.teacherId);
      setTeacherBio(cached.teacherBio);
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

      const [{ data: anns }, { data: words }, { data: members }, { data: myMembership }] = await Promise.all([
        supabase.from('class_announcements').select('id, message, created_at')
          .eq('class_id', id).order('created_at', { ascending: false }).limit(5),
        supabase.from('class_words').select('id').eq('class_id', id),
        supabase.from('class_members').select('student_id').eq('class_id', id),
        !teacher
          ? supabase.from('class_members').select('class_xp').eq('class_id', id).eq('student_id', user.id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      if (!teacher) setMyClassXp((myMembership as { class_xp: number } | null)?.class_xp ?? 0);

      const memberCount = members?.length ?? 0;
      const memberIds = (members ?? []).map((m: { student_id: string }) => m.student_id);
      memberIdsRef.current = memberIds;
      const annIds = ((anns ?? []) as Announcement[]).map(a => a.id);

      const [{ data: profiles }, { data: reads }, { data: tgts }, { data: tProfile }] = await Promise.all([
        memberCount > 0
          ? supabase.from('user_data').select('id, last_study_date').in('id', memberIds)
          : Promise.resolve({ data: [] as { last_study_date: string | null }[] }),
        teacher && annIds.length > 0
          ? supabase.from('class_announcement_reads').select('announcement_id').in('announcement_id', annIds)
          : Promise.resolve({ data: [] as { announcement_id: string }[] }),
        !teacher
          ? supabase.from('class_targets').select('id, title, due_date, completed_at, created_at')
              .eq('class_id', id).eq('student_id', user.id).order('created_at', { ascending: false })
          : Promise.resolve({ data: [] as Target[] }),
        !teacher
          ? supabase.from('profiles').select('name, bio').eq('id', cls.teacher_id).maybeSingle()
          : Promise.resolve({ data: null as { name?: string; bio?: string } | null }),
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

      const tProfileData = tProfile as { name?: string; bio?: string } | null;
      const snapshot: HomeCache = {
        className: cls.name, isTeacher: teacher,
        teacherName: tProfileData?.name ?? 'Teacher',
        teacherId: cls.teacher_id,
        teacherBio: tProfileData?.bio ?? '',
        announcements: (anns ?? []) as Announcement[],
        targets: (tgts ?? []) as Target[],
        wordCount: words?.length ?? 0, memberCount, activeToday, needsAttention,
        readCounts: counts,
      };
      _homeCache.set(cacheKey, snapshot);

      setClassName(snapshot.className);
      setIsTeacher(snapshot.isTeacher);
      setTeacherName(snapshot.teacherName);
      setTeacherId(snapshot.teacherId);
      setTeacherBio(snapshot.teacherBio);
      setAnnouncements(snapshot.announcements);
      setTargets(snapshot.targets);
      setWordCount(snapshot.wordCount);
      setMemberCount(snapshot.memberCount);
      setActiveToday(snapshot.activeToday);
      setNeedsAttention(snapshot.needsAttention);
      setReadCounts(snapshot.readCounts);
      setLoading(false);

      // Student: async homework pending count (doesn't block main render)
      if (!teacher) {
        (async () => {
          const { data: hwRows } = await supabase
            .from('class_homework')
            .select('id, modes, student_ids')
            .eq('class_id', id);
          const myHw = ((hwRows ?? []) as { id: string; modes: string[]; student_ids: string[] | null }[])
            .filter(h => !h.student_ids || h.student_ids.includes(user.id));
          if (myHw.length === 0) { setPendingHwCount(0); return; }
          const { data: prog } = await supabase
            .from('class_homework_progress')
            .select('homework_id, mode')
            .eq('student_id', user.id)
            .in('homework_id', myHw.map(h => h.id));
          const doneMap: Record<string, Set<string>> = {};
          for (const p of (prog ?? []) as { homework_id: string; mode: string }[]) {
            if (!doneMap[p.homework_id]) doneMap[p.homework_id] = new Set();
            doneMap[p.homework_id].add(p.mode);
          }
          setPendingHwCount(myHw.filter(h => !h.modes.every((m: string) => doneMap[h.id]?.has(m))).length);
        })();
      }
    })();
  }, [id, user, router]);

  const openXpHistory = async (s: StudentProfile) => {
    setXpHistoryStudent(s);
    setTeacherXpHistoryLoading(true);
    setTeacherXpHistory([]);
    const { data } = await supabase.rpc('get_student_xp_history', { p_class_id: id, p_student_id: s.id });
    setTeacherXpHistory((data ?? []) as { id: string; amount: number; reason: string; created_at: string }[]);
    setTeacherXpHistoryLoading(false);
  };

  const loadMyXpHistory = async () => {
    if (myXpHistoryLoaded || !user) return;
    setMyXpHistoryLoading(true);
    const { data } = await supabase
      .from('class_xp_history')
      .select('id, amount, reason, created_at')
      .eq('user_id', user.id)
      .eq('class_id', id)
      .order('created_at', { ascending: false })
      .limit(30);
    setMyXpHistory((data ?? []) as { id: string; amount: number; reason: string; created_at: string }[]);
    setMyXpHistoryLoaded(true);
    setMyXpHistoryLoading(false);
  };

  const openStudentsSheet = async () => {
    setShowStudents(true);
    setStudentsLoading(true);
    setStudentsError('');
    const { data, error } = await supabase.rpc('get_class_dashboard', { p_class_id: id });
    if (error) { setStudentsError(error.message); setStudentsLoading(false); return; }
    const list: StudentProfile[] = ((data ?? []) as { student_id: string; name: string; avatar_url: string | null; xp: number; streak: number; last_study_date: string | null; total_words: number }[])
      .map(r => ({ id: r.student_id, name: r.name, avatar_url: r.avatar_url, xp: r.xp ?? 0, streak: r.streak ?? 0, last_study_date: r.last_study_date, total_learned: r.total_words ?? 0 }));
    list.sort((a, b) => b.xp - a.xp);
    setStudents(list);
    setStudentsLoading(false);
  };

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
  const sortedPending = [...pending].sort((a, b) => {
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  });

  return (
    <div className="flex flex-col min-h-screen animate-fade-in pb-6">
      {/* Teacher bio sheet */}
      {showTeacherBio && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setShowTeacherBio(false)}>
          <div className="w-full max-w-md bg-[var(--surface)] rounded-t-3xl p-5 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
            <div className="w-9 h-1 rounded-full bg-[var(--border)] mx-auto" />
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-white font-black text-2xl shadow-lg"
                style={{ background: avatarColor(teacherId) }}>
                {(teacherName[0] || 'T').toUpperCase()}
              </div>
              <p className="text-lg font-bold text-[var(--text)]">{teacherName}</p>
              <span className="text-[10px] font-bold bg-[var(--primary-bg)] text-[var(--primary)] rounded-full px-2.5 py-0.5">Teacher</span>
            </div>
            <div className="bg-[var(--surface-2)] rounded-xl px-4 py-3">
              <p className="text-sm leading-relaxed text-center" style={{ color: teacherBio ? 'var(--text)' : 'var(--text-muted)', fontStyle: teacherBio ? 'normal' : 'italic' }}>
                {teacherBio || 'No bio yet'}
              </p>
            </div>
            <button onClick={() => setShowTeacherBio(false)}
              className="w-full py-3 rounded-xl text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-colors">
              Close
            </button>
          </div>
        </div>
      )}
      {/* Homework sheet */}
      {showHW && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setShowHW(false)}>
          <div className="w-full max-w-md bg-[var(--surface)] rounded-t-3xl flex flex-col max-h-[85dvh]" onClick={e => e.stopPropagation()}>
            <div className="pt-4 px-5 pb-3 shrink-0 border-b border-[var(--border)]">
              <div className="w-9 h-1 rounded-full bg-[var(--border)] mx-auto mb-3" />
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-[var(--text)]">📋 Pending Homework</h2>
                <span className="text-xs font-semibold text-[var(--text-muted)] bg-[var(--surface-2)] px-2.5 py-1 rounded-full">
                  {sortedPending.length} task{sortedPending.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 px-5 py-3 space-y-2">
              {sortedPending.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <p className="text-4xl">🎉</p>
                  <p className="text-sm font-bold text-[var(--text)]">All caught up!</p>
                  <p className="text-xs text-[var(--text-muted)]">No pending homework</p>
                </div>
              ) : sortedPending.map(t => {
                const due = dueLabel(t.due_date);
                return (
                  <div key={t.id} className="flex items-start gap-3 p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]">
                    <span className="text-lg mt-0.5 shrink-0">{due?.overdue ? '🔴' : '📌'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--text)] leading-snug">{t.title}</p>
                      {due ? (
                        <p className={`text-xs mt-0.5 font-medium ${due.overdue ? 'text-red-500' : 'text-[var(--text-muted)]'}`}>{due.text}</p>
                      ) : (
                        <p className="text-xs mt-0.5 text-[var(--text-muted)]">No deadline</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-5 pb-5 pt-3 shrink-0">
              <button onClick={() => setShowHW(false)} className="w-full btn-ghost py-3 text-sm">Close</button>
            </div>
          </div>
        </div>
      )}
      {/* Students sheet (teacher only) */}
      {showStudents && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setShowStudents(false)}>
          <div className="w-full max-w-md bg-[var(--surface)] rounded-t-3xl flex flex-col max-h-[90dvh]" onClick={e => e.stopPropagation()}>
            <div className="pt-4 px-5 pb-3 shrink-0 border-b border-[var(--border)]">
              <div className="w-9 h-1 rounded-full bg-[var(--border)] mx-auto mb-3" />
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-[var(--text)]">👥 Students</h2>
                <span className="text-xs font-semibold text-[var(--text-muted)] bg-[var(--surface-2)] px-2.5 py-1 rounded-full">{memberCount}</span>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 px-5 py-3 space-y-2">
              {studentsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-7 h-7 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : studentsError ? (
                <p className="text-center text-xs text-red-400 py-10 break-all px-2">{studentsError}</p>
              ) : students.length === 0 ? (
                <p className="text-center text-sm text-[var(--text-muted)] py-10">No students yet</p>
              ) : students.map((s, i) => {
                const today = new Date().toISOString().slice(0, 10);
                const isActive = s.last_study_date === today;
                return (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]">
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black shrink-0 bg-[var(--surface)] text-[var(--text-muted)]">{i + 1}</div>
                    {s.avatar_url ? (
                      <img src={s.avatar_url} alt={s.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-black text-sm shrink-0"
                        style={{ background: avatarColor(s.id) }}>
                        {(s.name[0] || '?').toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold text-sm truncate text-[var(--text)]">{s.name}</p>
                        {isActive && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--success)' }}>TODAY</span>
                        )}
                      </div>
                      {s.streak > 0 && <p className="text-xs text-[var(--text-muted)]">🔥 {s.streak} day streak</p>}
                    </div>
                    <button onClick={() => openXpHistory(s)} className="text-right shrink-0 hover:opacity-70 transition-opacity active:scale-95">
                      <p className="text-sm font-black" style={{ color: 'var(--primary)' }}>{(s.xp / 10).toFixed(1)} XP</p>
                      <p className="text-[10px] text-[var(--text-muted)]">{s.total_learned > 0 ? `${s.total_learned} words` : 'tap for history'}</p>
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="px-5 pb-5 pt-3 shrink-0">
              <button onClick={() => setShowStudents(false)} className="w-full btn-ghost py-3 text-sm">Close</button>
            </div>
          </div>
        </div>
      )}
      {/* Teacher: student XP history sheet */}
      {xpHistoryStudent && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50" onClick={() => setXpHistoryStudent(null)}>
          <div className="w-full max-w-md bg-[var(--surface)] rounded-t-3xl flex flex-col max-h-[80dvh]" onClick={e => e.stopPropagation()}>
            <div className="pt-4 px-5 pb-3 shrink-0 border-b border-[var(--border)]">
              <div className="w-9 h-1 rounded-full bg-[var(--border)] mx-auto mb-3" />
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-[var(--text)]">⚡ XP History</h2>
                  <p className="text-xs text-[var(--text-muted)]">{xpHistoryStudent.name} · {(xpHistoryStudent.xp / 10).toFixed(1)} XP total</p>
                </div>
                <button onClick={() => setXpHistoryStudent(null)} className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]">✕</button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 px-5 py-3 space-y-2">
              {teacherXpHistoryLoading ? (
                <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" /></div>
              ) : teacherXpHistory.length === 0 ? (
                <p className="text-center text-sm text-[var(--text-muted)] py-10">No XP history yet</p>
              ) : teacherXpHistory.map(h => (
                <XpHistoryRow key={h.id} entry={h} />
              ))}
            </div>
            <div className="px-5 pb-5 pt-3 shrink-0">
              <button onClick={() => setXpHistoryStudent(null)} className="w-full btn-ghost py-3 text-sm">Close</button>
            </div>
          </div>
        </div>
      )}
      {/* Hero */}
      <div
        className={`bg-gradient-to-br ${gradient} px-5 pt-6 pb-8 relative`}
        style={{ boxShadow: `0 8px 32px ${glow}55` }}
      >
        <div className="flex items-start gap-3 mb-4">
          {isTeacher ? (
            <span className="text-3xl">🏫</span>
          ) : (
            <button onClick={() => setShowTeacherBio(true)} className="shrink-0 focus:outline-none active:scale-95 transition-transform" aria-label="View teacher profile">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-black text-xl border-2 border-white/30 shadow-md"
                style={{ background: avatarColor(teacherId || id) }}>
                {(teacherName[0] || 'T').toUpperCase()}
              </div>
            </button>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black text-white leading-tight truncate">{className}</h1>
            <span className="inline-block text-[10px] font-bold bg-white/25 text-white rounded-full px-2.5 py-0.5 mt-0.5 mb-1">
              {isTeacher ? 'Teacher' : '🎓 Student'}
            </span>
            <p className="text-sm text-white/75">
              {isTeacher ? (
                <button onClick={openStudentsSheet} className="underline underline-offset-2 hover:opacity-80 transition-opacity active:scale-95">
                  {memberCount} students
                </button>
              ) : `Taught by ${teacherName}`}
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
          {[`📖 ${wordCount} words`, `✅ ${activeToday}/${memberCount} active`].map(label => (
            <span key={label} className="text-xs font-semibold bg-black/20 text-white rounded-full px-3 py-1">{label}</span>
          ))}
          {!isTeacher && (
            <button
              onClick={() => setShowHW(true)}
              className="text-xs font-semibold bg-black/20 text-white rounded-full px-3 py-1 hover:bg-black/35 transition-colors active:scale-95"
            >
              📋 {pending.length} pending
            </button>
          )}
          {!isTeacher && (
            <span className="text-xs font-semibold bg-black/20 text-white rounded-full px-3 py-1">
              ⚡ {(myClassXp / 10).toFixed(1)} XP
            </span>
          )}
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

        {/* Pending homework banner (student) */}
        {!isTeacher && pendingHwCount > 0 && (
          <button
            onClick={() => router.push(`/classes/${id}/homework`)}
            className="w-full text-left p-4 rounded-2xl flex items-center gap-3 active:scale-[0.98] transition-transform"
            style={{ background: 'linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 70%, #ec4899))' }}
          >
            <span className="text-2xl shrink-0">📋</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-white">
                {pendingHwCount === 1 ? 'You have new homework!' : `You have ${pendingHwCount} homework assignments`}
              </p>
              <p className="text-xs text-white/75">Tap to view and complete →</p>
            </div>
            <span className="text-white text-lg shrink-0">→</span>
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
                { icon: '👥', value: memberCount, label: 'Students', onClick: openStudentsSheet },
                { icon: '✅', value: activeToday, label: 'Active today', onClick: undefined },
                { icon: '📖', value: wordCount, label: 'Words', onClick: undefined },
              ].map(({ icon, value, label, onClick }) => (
                <div key={label} onClick={onClick}
                  className={`bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 flex flex-col items-center gap-1 ${onClick ? 'cursor-pointer hover:bg-[var(--surface-2)] active:scale-95 transition-all' : ''}`}>
                  <span className="text-xl">{icon}</span>
                  <span className="text-xl font-black text-[var(--text)]">{value}</span>
                  <span className="text-[10px] text-[var(--text-muted)] font-medium">{label}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* My XP History (student only) */}
        {!isTeacher && (
          <section>
            <button
              className="w-full flex items-center justify-between mb-3"
              onClick={() => { if (!myXpHistoryLoaded) loadMyXpHistory(); }}
            >
              <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">⚡ My XP History</h2>
              {!myXpHistoryLoaded && <span className="text-xs text-[var(--primary)] font-semibold">Load</span>}
            </button>
            {myXpHistoryLoading ? (
              <div className="flex justify-center py-6"><div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" /></div>
            ) : myXpHistoryLoaded && myXpHistory.length === 0 ? (
              <p className="text-sm text-center text-[var(--text-muted)] py-4">No XP earned in this class yet</p>
            ) : myXpHistoryLoaded ? (
              <div className="space-y-2">
                {myXpHistory.map(h => <XpHistoryRow key={h.id} entry={h} />)}
              </div>
            ) : null}
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
