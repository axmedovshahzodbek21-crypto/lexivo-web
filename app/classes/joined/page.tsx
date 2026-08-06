'use client';
import { SectionLoader } from '@/components/Loader';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
interface ClassRow {
  id: string;
  name: string;
  join_code: string;
  teacher_id: string;
  created_at: string;
}
interface Note { id: string; class_id: string; message: string; created_at: string; read_at: string | null; }
interface Target { id: string; class_id: string; title: string; due_date: string | null; completed_at: string | null; created_at: string; }
interface LeaderboardRow { student_id: string; name: string; avatar_url: string | null; xp: number; streak: number; total_words: number; }
interface Announcement { id: string; class_id: string; message: string; created_at: string; }

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function dueDateLabel(due: string | null): { text: string; overdue: boolean } | null {
  if (!due) return null;
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (due < today) return { text: `Overdue · ${new Date(due + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`, overdue: true };
  if (due === today) return { text: 'Due today', overdue: false };
  if (due === tomorrow) return { text: 'Due tomorrow', overdue: false };
  return { text: `Due ${new Date(due + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`, overdue: false };
}

const GLOW_COLORS = ['#818cf8','#ec4899','#22c55e','#3b82f6','#f59e0b','#8b5cf6','#ef4444','#06b6d4'];
const CLASS_COLORS = ['from-indigo-500 to-purple-500','from-pink-500 to-rose-400','from-emerald-500 to-teal-400','from-blue-500 to-cyan-400','from-amber-500 to-orange-400','from-violet-500 to-purple-400','from-red-500 to-pink-400','from-cyan-500 to-blue-400'];
function classGradient(id: string) {
  const n = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % CLASS_COLORS.length;
  return { gradient: CLASS_COLORS[n], glow: GLOW_COLORS[n] };
}

type Cache = {
  joinedClasses: ClassRow[];
  teacherProfiles: Record<string, { name: string; avatar_url: string | null }>;
  classNotes: Record<string, Note[]>;
  classTargets: Record<string, Target[]>;
  classAnnouncements: Record<string, Announcement[]>;
};
const _cache = new Map<string, Cache>();

export default function JoinedClassesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [joinedClasses, setJoinedClasses] = useState<ClassRow[]>([]);
  const [teacherProfiles, setTeacherProfiles] = useState<Record<string, { name: string; avatar_url: string | null }>>({});
  const [classNotes, setClassNotes] = useState<Record<string, Note[]>>({});
  const [classTargets, setClassTargets] = useState<Record<string, Target[]>>({});
  const [classAnnouncements, setClassAnnouncements] = useState<Record<string, Announcement[]>>({});
  const [classLeaderboards, setClassLeaderboards] = useState<Record<string, LeaderboardRow[]>>({});
  const [expandedLeaderboard, setExpandedLeaderboard] = useState<string | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (user) load(); else setLoading(false); }, [user?.id]);

  const applyCache = (c: Cache) => {
    setJoinedClasses(c.joinedClasses);
    setTeacherProfiles(c.teacherProfiles);
    setClassNotes(c.classNotes);
    setClassTargets(c.classTargets);
    setClassAnnouncements(c.classAnnouncements);
  };

  const load = async () => {
    if (!user) return;
    const cached = _cache.get(user.id);
    if (cached) { applyCache(cached); setLoading(false); }
    else setLoading(true);

    const { data: memberships } = await supabase.from('class_members').select('class_id').eq('student_id', user.id);
    let newJoined: ClassRow[] = [];
    if (memberships && memberships.length > 0) {
      const classIds = memberships.map((m: { class_id: string }) => m.class_id);
      const { data } = await supabase.from('classes').select('*').in('id', classIds);
      newJoined = (data ?? []).filter((c: ClassRow) => c.teacher_id !== user.id);
    }

    let newTeacherProfiles: Record<string, { name: string; avatar_url: string | null }> = {};
    let newNotes: Record<string, Note[]> = {};
    let newTargets: Record<string, Target[]> = {};
    let newAnnouncements: Record<string, Announcement[]> = {};

    if (newJoined.length > 0) {
      const teacherIds = [...new Set(newJoined.map((c: ClassRow) => c.teacher_id))];
      const joinedIds = newJoined.map((c: ClassRow) => c.id);

      const [{ data: teachers }, { data: notesData }, { data: targetsData }, { data: announcementsData }] = await Promise.all([
        supabase.from('profiles').select('id, name, avatar_url').in('id', teacherIds),
        supabase.from('class_notes').select('id, class_id, message, created_at, read_at').eq('student_id', user.id).order('created_at', { ascending: false }),
        supabase.from('class_targets').select('id, class_id, title, due_date, completed_at, created_at').eq('student_id', user.id).order('created_at', { ascending: false }),
        supabase.from('class_announcements').select('id, class_id, message, created_at').in('class_id', joinedIds).order('created_at', { ascending: false }),
      ]);

      for (const t of teachers ?? []) newTeacherProfiles[t.id] = { name: t.name, avatar_url: t.avatar_url };
      const unreadIds = (notesData ?? []).filter((n: Note) => !n.read_at).map((n: Note) => n.id);
      if (unreadIds.length > 0) supabase.from('class_notes').update({ read_at: new Date().toISOString() }).in('id', unreadIds).then(() => {});
      for (const n of notesData ?? []) { if (!newNotes[n.class_id]) newNotes[n.class_id] = []; newNotes[n.class_id].push(n); }
      for (const t of targetsData ?? []) { if (!newTargets[t.class_id]) newTargets[t.class_id] = []; newTargets[t.class_id].push(t); }
      for (const a of announcementsData ?? []) { if (!newAnnouncements[a.class_id]) newAnnouncements[a.class_id] = []; newAnnouncements[a.class_id].push(a); }
    }

    const fresh: Cache = { joinedClasses: newJoined, teacherProfiles: newTeacherProfiles, classNotes: newNotes, classTargets: newTargets, classAnnouncements: newAnnouncements };
    _cache.set(user.id, fresh);
    applyCache(fresh);
    setLoading(false);
  };

  const toggleTargetDone = async (target: Target) => {
    const completed_at = target.completed_at ? null : new Date().toISOString();
    await supabase.from('class_targets').update({ completed_at }).eq('id', target.id);
    setClassTargets(prev => {
      const updated = { ...prev };
      updated[target.class_id] = (updated[target.class_id] ?? []).map(t => t.id === target.id ? { ...t, completed_at } : t);
      return updated;
    });
  };

  const leaveClass = async (classId: string) => {
    if (!user) return;
    if (!confirm('Leave this class? You will need the class code to rejoin.')) return;
    await supabase.from('class_members').delete().eq('class_id', classId).eq('student_id', user.id);
    if (user) _cache.delete(user.id); load();
  };

  const toggleLeaderboard = async (classId: string) => {
    if (expandedLeaderboard === classId) { setExpandedLeaderboard(null); return; }
    setExpandedLeaderboard(classId);
    if (classLeaderboards[classId]) return;
    setLeaderboardLoading(classId);
    const { data } = await supabase.rpc('get_class_leaderboard', { p_class_id: classId }).limit(200);
    setClassLeaderboards(prev => ({ ...prev, [classId]: (data as LeaderboardRow[]) ?? [] }));
    setLeaderboardLoading(null);
  };

  return (
    <div className="flex flex-col min-h-screen pb-24 animate-fade-in">
      <div className="flex items-center gap-3 p-4 border-b border-[var(--border)]">
        <button onClick={() => router.push('/classes')} className="btn-icon text-lg" aria-label="Go back">←</button>
        <div className="flex-1">
          <h1 className="font-bold text-[var(--text)]">🎓 Joined Classes</h1>
          <p className="text-xs text-[var(--text-muted)]">Classes you are enrolled in</p>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto w-full">
        {loading ? (
          <SectionLoader />
        ) : joinedClasses.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-[var(--border)] p-12 text-center space-y-3 opacity-60">
            <p className="text-5xl">🎓</p>
            <p className="text-base font-bold text-[var(--text)]">Not enrolled yet</p>
            <p className="text-sm text-[var(--text-muted)]">Go back and tap &quot;Join a Class&quot; to enroll</p>
          </div>
        ) : joinedClasses.map(cls => {
          const notes = classNotes[cls.id] ?? [];
          const unreadNotes = notes.filter(n => !n.read_at).length;
          const targets = classTargets[cls.id] ?? [];
          const activeTargets = targets.filter(t => !t.completed_at);
          const doneTargets = targets.filter(t => t.completed_at);
          const { gradient, glow } = classGradient(cls.id);

          return (
            <div key={cls.id} className="rounded-2xl overflow-hidden border border-[var(--border)]"
              style={{ boxShadow: `0 6px 0 ${glow}55, 0 12px 30px ${glow}33` }}>
              <div className={`bg-gradient-to-br ${gradient} px-4 pt-4 pb-5`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-black text-white text-lg leading-tight">{cls.name}</p>
                      {unreadNotes > 0 && <span className="bg-white/25 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{unreadNotes} new</span>}
                    </div>
                    <p className="text-sm text-white/70 mt-0.5">👩‍🏫 {teacherProfiles[cls.teacher_id]?.name ?? 'Teacher'} · {cls.join_code}</p>
                    {activeTargets.length > 0 && (
                      <div className="flex gap-2 mt-2.5 flex-wrap">
                        <span className="text-xs bg-black/20 text-white font-semibold px-2.5 py-1 rounded-full">🎯 {activeTargets.length} target{activeTargets.length !== 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0 items-end">
                    <button onClick={() => router.push(`/classes/${cls.id}/home`)} className="bg-white text-gray-900 font-black text-xs px-3.5 py-1.5 rounded-xl hover:opacity-90 transition-opacity">Enter →</button>
                    <div className="flex gap-1">
                      <button onClick={() => toggleLeaderboard(cls.id)} className={`text-xs px-2 py-1 rounded-lg font-medium transition-all ${expandedLeaderboard === cls.id ? 'bg-white/30 text-white' : 'bg-black/20 text-white/80 hover:bg-black/30'}`}>🏆</button>
                      <button onClick={() => leaveClass(cls.id)} className="text-xs px-2 py-1 rounded-lg bg-black/20 text-white/80 hover:bg-red-500/40 transition-colors font-medium">Leave</button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-[var(--surface)] divide-y divide-[var(--border)]">
                {(classAnnouncements[cls.id] ?? []).length > 0 && (
                  <div className="px-4 pt-3 pb-3 space-y-2">
                    <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">📢 Announcements</p>
                    {(classAnnouncements[cls.id] ?? []).map(a => {
                      const isNew = Date.now() - new Date(a.created_at).getTime() < 24 * 3600000;
                      return (
                        <div key={a.id} className="rounded-xl px-3 py-2.5"
                          style={{ background: isNew ? 'var(--primary-bg)' : 'var(--surface-2)', borderLeft: isNew ? '3px solid var(--primary)' : 'none' }}>
                          <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-[var(--text)] leading-snug">{a.message}</p>
                              <p className="text-[10px] text-[var(--text-muted)] mt-1">{timeAgo(a.created_at)}</p>
                            </div>
                            {isNew && <span className="text-[10px] font-bold text-[var(--primary)] shrink-0 mt-0.5">NEW</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {expandedLeaderboard === cls.id && (
                  <div className="px-4 pt-3 pb-3 space-y-2">
                    <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">🏆 Class Leaderboard</p>
                    {leaderboardLoading === cls.id ? (
                      <SectionLoader rows={2} />
                    ) : (classLeaderboards[cls.id] ?? []).length === 0 ? (
                      <p className="text-xs text-[var(--text-muted)] text-center py-2">No data yet</p>
                    ) : (classLeaderboards[cls.id] ?? []).map((row, idx) => {
                      const isMe = row.student_id === user?.id;
                      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;
                      return (
                        <div key={row.student_id} className="flex items-center gap-2.5 rounded-xl px-3 py-2"
                          style={{ background: isMe ? 'var(--primary-bg)' : 'var(--surface-2)', border: isMe ? '1.5px solid var(--primary)' : 'none' }}>
                          <span className="text-sm w-5 text-center shrink-0 font-bold" style={{ color: isMe ? 'var(--primary)' : 'var(--text-muted)' }}>{medal ?? `${idx + 1}`}</span>
                          {row.avatar_url
                            ? <img src={row.avatar_url} alt={row.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
                            : <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-black" style={{ background: 'var(--primary)' }}>{row.name.charAt(0).toUpperCase()}</div>}
                          <p className={`flex-1 text-sm truncate ${isMe ? 'font-bold text-[var(--primary)]' : 'text-[var(--text)]'}`}>{row.name}{isMe ? ' (you)' : ''}</p>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-bold text-[var(--primary)]">{row.xp} XP</p>
                            <p className="text-[10px] text-[var(--text-muted)]">🔥 {row.streak}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {targets.length > 0 && (
                  <div className="px-4 pt-3 pb-3 space-y-2">
                    <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">🎯 Targets</p>
                    {[...activeTargets, ...doneTargets].map(target => {
                      const due = dueDateLabel(target.due_date);
                      return (
                        <button key={target.id} onClick={() => toggleTargetDone(target)}
                          className="w-full flex items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-2)]"
                          style={{ background: target.completed_at ? 'transparent' : 'var(--surface-2)' }}>
                          <span className="text-base shrink-0 mt-0.5">{target.completed_at ? '✅' : '⬜'}</span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm leading-snug ${target.completed_at ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text)] font-medium'}`}>{target.title}</p>
                            {due && !target.completed_at && <p className={`text-[10px] mt-0.5 font-medium ${due.overdue ? 'text-[var(--danger)]' : 'text-[var(--text-muted)]'}`}>{due.text}</p>}
                            {target.completed_at && <p className="text-[10px] mt-0.5 text-[var(--text-muted)]">Done {timeAgo(target.completed_at)}</p>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {notes.length > 0 && (
                  <div className="px-4 pt-3 pb-3 space-y-2">
                    <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">✉️ Notes from teacher</p>
                    {notes.map(note => (
                      <div key={note.id} className="rounded-xl px-3 py-2.5 text-sm"
                        style={{ background: note.read_at ? 'var(--surface-2)' : 'var(--primary-bg)', borderLeft: note.read_at ? 'none' : '3px solid var(--primary)' }}>
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-[var(--text)] leading-snug">{note.message}</p>
                            <p className="text-[10px] text-[var(--text-muted)] mt-1">{timeAgo(note.created_at)}</p>
                          </div>
                          {!note.read_at && <span className="text-[10px] font-bold text-[var(--primary)] shrink-0 mt-0.5">NEW</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
