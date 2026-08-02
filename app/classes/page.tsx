'use client';
import { PageLoader, SectionLoader } from '@/components/Loader';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { saveClassHWTemp } from '@/lib/storage';

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return 'LEXI-' + Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

interface ClassRow {
  id: string;
  name: string;
  join_code: string;
  teacher_id: string;
  created_at: string;
  member_count?: number;
}

interface Note {
  id: string;
  class_id: string;
  message: string;
  created_at: string;
  read_at: string | null;
}

interface Target {
  id: string;
  class_id: string;
  title: string;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
}

interface LeaderboardRow {
  student_id: string;
  name: string;
  avatar_url: string | null;
  xp: number;
  streak: number;
  total_words: number;
}

interface ClassWord {
  id: string;
  class_id: string;
  word: string;
  translation: string;
  definition: string | null;
  example1: string | null;
  example1_translation: string | null;
  example2: string | null;
  example2_translation: string | null;
  folder_name: string | null;
  collection_name: string | null;
}

interface Announcement {
  id: string;
  class_id: string;
  message: string;
  created_at: string;
}

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

const CLASS_COLORS = [
  'from-indigo-500 to-purple-500', 'from-pink-500 to-rose-400',
  'from-emerald-500 to-teal-400', 'from-blue-500 to-cyan-400',
  'from-amber-500 to-orange-400', 'from-violet-500 to-purple-400',
  'from-red-500 to-pink-400', 'from-cyan-500 to-blue-400',
];
const GLOW_COLORS = ['#818cf8','#ec4899','#22c55e','#3b82f6','#f59e0b','#8b5cf6','#ef4444','#06b6d4'];
function classGradient(id: string) {
  const n = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % CLASS_COLORS.length;
  return { gradient: CLASS_COLORS[n], glow: GLOW_COLORS[n] };
}

type ClassesCache = {
  myClasses: ClassRow[];
  joinedClasses: ClassRow[];
  teacherProfiles: Record<string, { name: string; avatar_url: string | null }>;
  classNotes: Record<string, Note[]>;
  classTargets: Record<string, Target[]>;
  classAnnouncements: Record<string, Announcement[]>;
  classWords: Record<string, ClassWord[]>;
  learnedWordIds: string[];
};
const _classesCache = new Map<string, ClassesCache>();

export default function ClassesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [myClasses, setMyClasses] = useState<ClassRow[]>([]);
  const [joinedClasses, setJoinedClasses] = useState<ClassRow[]>([]);
  const [classNotes, setClassNotes] = useState<Record<string, Note[]>>({});
  const [classTargets, setClassTargets] = useState<Record<string, Target[]>>({});
  const [teacherProfiles, setTeacherProfiles] = useState<Record<string, { name: string; avatar_url: string | null }>>({});
  const [classAnnouncements, setClassAnnouncements] = useState<Record<string, Announcement[]>>({});
  const [classLeaderboards, setClassLeaderboards] = useState<Record<string, LeaderboardRow[]>>({});
  const [expandedLeaderboard, setExpandedLeaderboard] = useState<string | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [className, setClassName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState('');
  const [joinError, setJoinError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [classWords, setClassWords] = useState<Record<string, ClassWord[]>>({});
  const [learnedWordIds, setLearnedWordIds] = useState<Set<string>>(new Set<string>());
  const [flashcard, setFlashcard] = useState<{ words: ClassWord[]; label: string; index: number; flipped: boolean } | null>(null);

  const fetchAnnouncements = async (classIds: string[]): Promise<Record<string, Announcement[]>> => {
    const { data } = await supabase
      .from('class_announcements')
      .select('id, class_id, message, created_at')
      .in('class_id', classIds)
      .order('created_at', { ascending: false });
    const map: Record<string, Announcement[]> = {};
    for (const a of data ?? []) {
      if (!map[a.class_id]) map[a.class_id] = [];
      map[a.class_id].push(a);
    }
    return map;
  };

  const fetchNotes = async (userId: string): Promise<Record<string, Note[]>> => {
    const { data } = await supabase
      .from('class_notes')
      .select('id, class_id, message, created_at, read_at')
      .eq('student_id', userId)
      .order('created_at', { ascending: false });
    if (!data || data.length === 0) return {};
    const map: Record<string, Note[]> = {};
    for (const n of data) {
      if (!map[n.class_id]) map[n.class_id] = [];
      map[n.class_id].push(n);
    }
    const unreadIds = data.filter((n: Note) => !n.read_at).map((n: Note) => n.id);
    if (unreadIds.length > 0) {
      supabase.from('class_notes').update({ read_at: new Date().toISOString() }).in('id', unreadIds).then(() => {});
    }
    return map;
  };

  const fetchTargets = async (userId: string): Promise<Record<string, Target[]>> => {
    const { data } = await supabase
      .from('class_targets')
      .select('id, class_id, title, due_date, completed_at, created_at')
      .eq('student_id', userId)
      .order('created_at', { ascending: false });
    if (!data || data.length === 0) return {};
    const map: Record<string, Target[]> = {};
    for (const t of data) {
      if (!map[t.class_id]) map[t.class_id] = [];
      map[t.class_id].push(t);
    }
    return map;
  };

  const fetchHomework = async (classIds: string[], userId: string): Promise<{ words: Record<string, ClassWord[]>; learnedIds: string[] }> => {
    if (classIds.length === 0) return { words: {}, learnedIds: [] };
    const [{ data: wordData }, { data: progress }] = await Promise.all([
      supabase
        .from('class_words')
        .select('id, class_id, word, translation, definition, example1, example1_translation, example2, example2_translation, folder_name, collection_name')
        .in('class_id', classIds)
        .order('created_at', { ascending: true }),
      supabase.from('class_word_progress').select('word_id').eq('student_id', userId),
    ]);
    const words: Record<string, ClassWord[]> = {};
    for (const w of wordData ?? []) {
      if (!words[w.class_id]) words[w.class_id] = [];
      words[w.class_id].push(w as ClassWord);
    }
    return { words, learnedIds: (progress ?? []).map((p: { word_id: string }) => p.word_id) };
  };

  const markLearned = async (wordId: string) => {
    if (!user || learnedWordIds.has(wordId)) return;
    await supabase.from('class_word_progress').insert({ word_id: wordId, student_id: user.id });
    setLearnedWordIds(prev => new Set<string>([...prev, wordId]));
  };

  const unmarkLearned = async (wordId: string) => {
    if (!user || !learnedWordIds.has(wordId)) return;
    await supabase.from('class_word_progress').delete().eq('word_id', wordId).eq('student_id', user.id);
    setLearnedWordIds(prev => { const s = new Set<string>(prev); s.delete(wordId); return s; });
  };

  const applyCache = (c: ClassesCache) => {
    setMyClasses(c.myClasses);
    setJoinedClasses(c.joinedClasses);
    setTeacherProfiles(c.teacherProfiles);
    setClassNotes(c.classNotes);
    setClassTargets(c.classTargets);
    setClassAnnouncements(c.classAnnouncements);
    setClassWords(c.classWords);
    setLearnedWordIds(new Set<string>(c.learnedWordIds));
  };

  const load = async () => {
    if (!user) return;

    // Serve stale data instantly, then refresh silently in background
    const cached = _classesCache.get(user.id);
    if (cached) { applyCache(cached); setLoading(false); }
    else setLoading(true);

    // Fetch taught classes and student memberships in parallel
    const [{ data: taught }, { data: memberships }] = await Promise.all([
      supabase.from('classes').select('*').eq('teacher_id', user.id).order('created_at', { ascending: false }),
      supabase.from('class_members').select('class_id').eq('student_id', user.id),
    ]);

    // One batch query for member counts instead of N individual queries
    const taughtIds = (taught ?? []).map((c: ClassRow) => c.id);
    let newMyClasses: ClassRow[] = [];
    if (taughtIds.length > 0) {
      const { data: memberRows } = await supabase.from('class_members').select('class_id').in('class_id', taughtIds);
      const countMap: Record<string, number> = {};
      for (const m of memberRows ?? []) countMap[m.class_id] = (countMap[m.class_id] ?? 0) + 1;
      newMyClasses = (taught ?? []).map((c: ClassRow) => ({ ...c, member_count: countMap[c.id] ?? 0 }));
    }

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
    let newWords: Record<string, ClassWord[]> = {};
    let newLearnedIds: string[] = [];

    if (newJoined.length > 0) {
      const teacherIds = [...new Set(newJoined.map((c: ClassRow) => c.teacher_id))];
      const joinedIds = newJoined.map((c: ClassRow) => c.id);
      const [{ data: teachers }, notes, targets, announcements, homework] = await Promise.all([
        supabase.from('profiles').select('id, name, avatar_url').in('id', teacherIds),
        fetchNotes(user.id),
        fetchTargets(user.id),
        fetchAnnouncements(joinedIds),
        fetchHomework(joinedIds, user.id),
      ]);
      for (const t of teachers ?? []) newTeacherProfiles[t.id] = { name: t.name, avatar_url: t.avatar_url };
      newNotes = notes;
      newTargets = targets;
      newAnnouncements = announcements;
      newWords = homework.words;
      newLearnedIds = homework.learnedIds;
    }

    const fresh: ClassesCache = {
      myClasses: newMyClasses, joinedClasses: newJoined,
      teacherProfiles: newTeacherProfiles, classNotes: newNotes,
      classTargets: newTargets, classAnnouncements: newAnnouncements,
      classWords: newWords, learnedWordIds: newLearnedIds,
    };
    _classesCache.set(user.id, fresh);
    applyCache(fresh);
    setLoading(false);
  };

  useEffect(() => { if (user) load(); else setLoading(false); }, [user]);

  const toggleTargetDone = async (target: Target) => {
    const completed_at = target.completed_at ? null : new Date().toISOString();
    await supabase.from('class_targets').update({ completed_at }).eq('id', target.id);
    setClassTargets(prev => {
      const updated = { ...prev };
      updated[target.class_id] = (updated[target.class_id] ?? []).map(t =>
        t.id === target.id ? { ...t, completed_at } : t
      );
      return updated;
    });
  };

  const createClass = async () => {
    if (!user || !className.trim()) return;
    setCreating(true);
    setError('');
    const code = generateCode();
    const { error: err } = await supabase.from('classes').insert({
      name: className.trim(),
      join_code: code,
      teacher_id: user.id,
    });
    if (err) setError('Failed to create class. Please try again.');
    else { setClassName(''); setShowCreate(false); _classesCache.delete(user.id); load(); }
    setCreating(false);
  };

  const joinClass = async () => {
    if (!user || !joinCode.trim()) return;
    setJoinError('');
    const code = joinCode.trim().toUpperCase();
    const { data: cls } = await supabase.from('classes').select('id, teacher_id').eq('join_code', code).single();
    if (!cls) { setJoinError('Class not found. Check the code and try again.'); return; }
    if (cls.teacher_id === user.id) { setJoinError("You can't join your own class as a student."); return; }
    const { error: err } = await supabase.from('class_members').insert({ class_id: cls.id, student_id: user.id });
    if (err) {
      if (err.code === '23505') setJoinError('You are already in this class.');
      else setJoinError('Failed to join. Please try again.');
    } else { setJoinCode(''); _classesCache.delete(user.id); load(); }
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

  const leaveClass = async (classId: string) => {
    if (!user) return;
    if (!confirm('Leave this class? You will need the class code to rejoin.')) return;
    await supabase.from('class_members').delete().eq('class_id', classId).eq('student_id', user.id);
    _classesCache.delete(user.id); load();
  };

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const deleteClass = async (classId: string) => {
    if (!user) return;
    await supabase.from('classes').delete().eq('id', classId);
    setDeleteConfirmId(null);
    _classesCache.delete(user.id); load();
  };

  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [renaming, setRenaming] = useState(false);

  const startRename = (cls: ClassRow) => {
    setRenamingId(cls.id);
    setRenameText(cls.name);
  };

  const saveRename = async (classId: string) => {
    if (!renameText.trim()) return;
    setRenaming(true);
    await supabase.from('classes').update({ name: renameText.trim() }).eq('id', classId);
    setRenamingId(null);
    setRenaming(false);
    load();
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyLink = (code: string, id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/join/${code}`);
    setCopiedLinkId(id);
    setTimeout(() => setCopiedLinkId(null), 2000);
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8">
        <div className="text-5xl">👩‍🏫</div>
        <h1 className="text-xl font-bold text-[var(--text)]">Classes</h1>
        <p className="text-[var(--text-muted)] text-center">Sign in to create or join a class</p>
        <button onClick={() => router.push('/login')} className="btn-primary">Sign in</button>
      </div>
    );
  }

  const fcWords = flashcard?.words ?? [];
  const fcWord = flashcard && fcWords.length > 0 ? (fcWords[flashcard.index] ?? null) : null;
  const fcLearnedCount = fcWords.filter(w => learnedWordIds.has(w.id)).length;
  const fcIsLearned = fcWord ? learnedWordIds.has(fcWord.id) : false;

  return (
    <div className="flex flex-col min-h-screen pb-24 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-[var(--border)]">
        <button onClick={() => router.back()} className="btn-icon text-lg" aria-label="Go back">←</button>
        <div className="flex-1">
          <h1 className="font-bold text-[var(--text)]">👩‍🏫 Classes</h1>
          <p className="text-xs text-[var(--text-muted)]">Create or join a class</p>
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <SectionLoader />
        ) : (
          <div className="flex flex-col md:flex-row gap-4 items-start">

            {/* ── My Classes ─────────────────────────────── */}
            <div className="flex-1 min-w-0 space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] px-1">My Classes</p>
              {myClasses.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-[var(--border)] p-8 text-center space-y-2 opacity-60">
                  <p className="text-4xl">👩‍🏫</p>
                  <p className="text-sm font-bold text-[var(--text)]">No classes yet</p>
                  <p className="text-xs text-[var(--text-muted)]">Create your first class</p>
                </div>
              ) : myClasses.map(cls => {
                const { gradient, glow } = classGradient(cls.id);
                return (
                  <div key={cls.id} className={`rounded-2xl overflow-hidden bg-gradient-to-br ${gradient} transition-transform hover:-translate-y-0.5`}
                    style={{ boxShadow: `0 6px 0 ${glow}88, 0 14px 32px ${glow}44` }}>
                    <div className="p-4 cursor-pointer" onClick={() => router.push(`/classes/${cls.id}/home`)}>
                      {renamingId === cls.id ? (
                        <div className="flex items-center gap-2 mb-2">
                          <input autoFocus value={renameText}
                            onChange={e => setRenameText(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveRename(cls.id); if (e.key === 'Escape') setRenamingId(null); }}
                            onClick={e => e.stopPropagation()}
                            className="flex-1 px-2 py-1 rounded-lg bg-black/20 text-white text-sm font-bold focus:outline-none" />
                          <button onClick={e => { e.stopPropagation(); saveRename(cls.id); }} disabled={renaming} className="text-white/80 font-bold text-xs">✓</button>
                          <button onClick={e => { e.stopPropagation(); setRenamingId(null); }} className="text-white/60 text-xs">✕</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-xl font-black text-white leading-tight">{cls.name}</p>
                          <button onClick={e => { e.stopPropagation(); startRename(cls); }} className="text-white/40 hover:text-white/80 text-sm transition-colors">✏️</button>
                        </div>
                      )}
                      <p className="text-sm text-white/60">👥 {cls.member_count ?? 0} student{(cls.member_count ?? 0) !== 1 ? 's' : ''}</p>
                      <div className="flex items-center gap-2 mt-3">
                        <code className="text-xs font-black text-white bg-black/25 px-2.5 py-1 rounded-xl tracking-wider">{cls.join_code}</code>
                        <button onClick={e => { e.stopPropagation(); copyCode(cls.join_code, cls.id); }} className="text-base transition-transform hover:scale-110">{copiedId === cls.id ? '✅' : '📋'}</button>
                        <button onClick={e => { e.stopPropagation(); copyLink(cls.join_code, cls.id); }} className="text-base transition-transform hover:scale-110">{copiedLinkId === cls.id ? '✅' : '🔗'}</button>
                      </div>
                    </div>
                    <div className="bg-black/20 flex items-center justify-between px-4 py-2.5">
                      <button onClick={e => { e.stopPropagation(); setDeleteConfirmId(cls.id); }} className="text-xs text-white/40 hover:text-red-300 transition-colors font-medium">Delete</button>
                      <button onClick={() => router.push(`/classes/${cls.id}/home`)} className="text-xs font-black text-white bg-white/20 hover:bg-white/30 px-3.5 py-1.5 rounded-xl transition-colors">Enter →</button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Classes I've Joined ─────────────────────── */}
            <div className="flex-1 min-w-0 space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] px-1">Classes I&apos;ve Joined</p>
              {joinedClasses.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-[var(--border)] p-8 text-center space-y-2 opacity-60">
                  <p className="text-4xl">🎓</p>
                  <p className="text-sm font-bold text-[var(--text)]">Not enrolled yet</p>
                  <p className="text-xs text-[var(--text-muted)]">Enter a code to join a class</p>
                </div>
              ) : joinedClasses.map(cls => {
                const notes = classNotes[cls.id] ?? [];
                const unreadNotes = notes.filter(n => !n.read_at).length;
                const targets = classTargets[cls.id] ?? [];
                const activeTargets = targets.filter(t => !t.completed_at);
                const doneTargets = targets.filter(t => t.completed_at);
                const hw = classWords[cls.id] ?? [];
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
                          <div className="flex gap-2 mt-2.5 flex-wrap">
                            {hw.length > 0 && <span className="text-xs bg-black/20 text-white font-semibold px-2.5 py-1 rounded-full">📖 {hw.length} words</span>}
                            {activeTargets.length > 0 && <span className="text-xs bg-black/20 text-white font-semibold px-2.5 py-1 rounded-full">🎯 {activeTargets.length} target{activeTargets.length !== 1 ? 's' : ''}</span>}
                          </div>
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
                      {hw.length > 0 && (() => {
                        const grouped: Record<string, Record<string, ClassWord[]>> = {};
                        for (const w of hw) {
                          const folder = w.folder_name ?? '';
                          const col = w.collection_name ?? '';
                          if (!grouped[folder]) grouped[folder] = {};
                          if (!grouped[folder][col]) grouped[folder][col] = [];
                          grouped[folder][col].push(w);
                        }
                        const studyBtns = (words: ClassWord[], label: string) => (
                          <div className="flex gap-1.5 shrink-0">
                            <button onClick={() => { const firstUnlearned = words.findIndex(w => !learnedWordIds.has(w.id)); setFlashcard({ words, label, index: firstUnlearned >= 0 ? firstUnlearned : 0, flipped: false }); }} className="text-xs font-semibold px-2.5 py-1 rounded-xl bg-[var(--primary)] text-white">Study →</button>
                            <button onClick={() => { saveClassHWTemp(words.map(w => ({ word: w.word, translation: w.translation, definition: w.definition ?? '', example1: w.example1 ?? '', example1Translation: w.example1_translation ?? '', example2: w.example2 ?? '', example2Translation: w.example2_translation ?? '', className: label }))); router.push('/flashcards?source=class-hw'); }} className="text-xs font-semibold px-2.5 py-1 rounded-xl text-white" style={{ background: '#FF6B35' }}>🃏</button>
                            <button onClick={() => { saveClassHWTemp(words.map(w => ({ word: w.word, translation: w.translation, definition: w.definition ?? '', example1: w.example1 ?? '', example1Translation: w.example1_translation ?? '', example2: w.example2 ?? '', example2Translation: w.example2_translation ?? '', className: label }))); router.push('/quiz?source=class-hw'); }} className="text-xs font-semibold px-2.5 py-1 rounded-xl text-white" style={{ background: '#F59E0B' }}>❓</button>
                          </div>
                        );
                        const progressBar = (words: ClassWord[]) => {
                          const learned = words.filter(w => learnedWordIds.has(w.id)).length;
                          const pct = (learned / words.length) * 100;
                          const done = learned === words.length;
                          return (
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-[var(--text-muted)]">{learned}/{words.length} learned</span>
                                {done && <span className="text-[10px] font-bold" style={{ color: 'var(--success)' }}>All done! 🎉</span>}
                              </div>
                              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: done ? 'var(--success)' : 'var(--primary)' }} />
                              </div>
                            </div>
                          );
                        };
                        return (
                          <div className="px-4 pt-3 pb-3 space-y-3">
                            <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">📝 Homework</p>
                            {Object.entries(grouped).map(([folder, colMap]) => (
                              <div key={folder} className="space-y-2">
                                {folder && <p className="text-xs font-bold text-[var(--text)] flex items-center gap-1">📁 {folder}</p>}
                                {Object.entries(colMap).map(([col, words]) => {
                                  const label = [folder, col].filter(Boolean).join(' · ') || cls.name;
                                  return (
                                    <div key={col} className="rounded-xl p-3 space-y-2" style={{ background: 'var(--surface-2)' }}>
                                      <div className="flex items-center justify-between gap-2">
                                        <p className="text-xs font-semibold text-[var(--text)] truncate">{col ? `📖 ${col}` : cls.name} <span className="text-[var(--text-muted)] font-normal">· {words.length} words</span></p>
                                        {studyBtns(words, label)}
                                      </div>
                                      {progressBar(words)}
                                    </div>
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Actions Sidebar ─────────────────────────── */}
            <div className="w-full md:w-44 shrink-0 space-y-3">
              <button
                onClick={() => setShowCreate(true)}
                className="w-full py-3.5 rounded-2xl font-black text-sm text-white transition-transform hover:-translate-y-0.5 active:translate-y-0"
                style={{
                  background: 'linear-gradient(135deg, var(--primary) 0%, #9333ea 100%)',
                  boxShadow: '0 5px 0 rgba(80,30,200,0.55), 0 10px 24px rgba(109,60,255,0.4)',
                }}
              >
                + Create Class
              </button>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
                <div className="px-4 pt-3 pb-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Join a Class</p>
                </div>
                <div className="px-3 pb-3 space-y-2">
                  <input
                    type="text"
                    placeholder="e.g. LEXI-8X2K"
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === 'Enter' && joinClass()}
                    className="w-full px-3 py-2.5 rounded-xl bg-[var(--surface-2)] text-[var(--text)] text-xs font-mono focus:outline-none"
                    maxLength={9}
                  />
                  <button onClick={joinClass} className="w-full py-2.5 rounded-xl font-bold text-xs text-white hover:opacity-90 transition-opacity"
                    style={{ background: 'var(--primary)' }}>
                    Join →
                  </button>
                  {joinError && <p className="text-xs text-[var(--danger)]">{joinError}</p>}
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Flashcard modal */}
      {flashcard && fcWord && (
        <div className="fixed inset-0 z-50 bg-[var(--background)] flex flex-col animate-fade-in">
          {/* Header */}
          <div className="flex items-center gap-3 p-4 border-b border-[var(--border)] shrink-0">
            <button
              onClick={() => setFlashcard(null)}
              className="btn-icon text-lg"
              aria-label="Close"
            >
              ✕
            </button>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[var(--text)] truncate">{flashcard?.label ?? ''}</p>
              <p className="text-xs text-[var(--text-muted)]">{fcLearnedCount}/{fcWords.length} learned</p>
            </div>
            <p className="text-sm font-bold text-[var(--text-muted)] shrink-0">{flashcard.index + 1} / {fcWords.length}</p>
          </div>

          {/* Progress bar */}
          <div className="h-1 shrink-0" style={{ background: 'var(--border)' }}>
            <div
              className="h-full transition-all"
              style={{ width: `${((flashcard.index + 1) / fcWords.length) * 100}%`, background: 'var(--primary)' }}
            />
          </div>

          {/* Card */}
          <div className="flex-1 flex items-center justify-center p-6">
            <button
              onClick={() => setFlashcard(prev => prev ? { ...prev, flipped: !prev.flipped } : null)}
              className="w-full max-w-sm rounded-3xl border-2 p-8 text-center space-y-3 transition-all active:scale-95 min-h-[220px] flex flex-col items-center justify-center"
              style={{
                background: fcIsLearned ? 'rgba(16,185,129,0.08)' : 'var(--surface-2)',
                borderColor: fcIsLearned ? 'var(--success)' : 'var(--border)',
              }}
            >
              {fcIsLearned && (
                <span className="text-xs font-bold" style={{ color: 'var(--success)' }}>✓ Learned</span>
              )}
              {!flashcard.flipped ? (
                <>
                  <p className="text-3xl font-black text-[var(--text)]">{fcWord.word}</p>
                  <p className="text-sm text-[var(--text-muted)]">Tap to reveal</p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold text-[var(--primary)]">{fcWord.translation}</p>
                  {fcWord.definition && (
                    <p className="text-sm text-[var(--text-muted)] leading-snug">{fcWord.definition}</p>
                  )}
                  {fcWord.example1 && (
                    <p className="text-xs italic text-[var(--text-muted)] leading-snug">&ldquo;{fcWord.example1}&rdquo;</p>
                  )}
                  {fcWord.example1_translation && (
                    <p className="text-xs italic text-[var(--text-muted)] leading-snug">&ldquo;{fcWord.example1_translation}&rdquo;</p>
                  )}
                </>
              )}
            </button>
          </div>

          {/* Actions */}
          <div className="p-4 space-y-3 shrink-0" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
            {flashcard.flipped && (
              <button
                onClick={() => {
                  if (fcIsLearned) unmarkLearned(fcWord.id);
                  else markLearned(fcWord.id);
                }}
                className={`w-full py-3.5 rounded-2xl font-bold text-sm transition-all ${fcIsLearned ? 'bg-[var(--surface-2)] text-[var(--text-muted)]' : 'btn-primary'}`}
              >
                {fcIsLearned ? '✕ Unmark as learned' : '✓ Got it — mark as learned'}
              </button>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setFlashcard(prev => prev && prev.index > 0 ? { ...prev, index: prev.index - 1, flipped: false } : prev)}
                disabled={flashcard.index === 0}
                className="flex-1 py-3 rounded-2xl text-sm font-semibold text-[var(--text)] disabled:opacity-30"
                style={{ background: 'var(--surface-2)' }}
              >
                ← Prev
              </button>
              <button
                onClick={() => {
                  if (flashcard.index < fcWords.length - 1) {
                    setFlashcard(prev => prev ? { ...prev, index: prev.index + 1, flipped: false } : null);
                  } else {
                    setFlashcard(null);
                  }
                }}
                className="flex-1 py-3 rounded-2xl text-sm font-semibold text-[var(--text)]"
                style={{ background: 'var(--surface-2)' }}
              >
                {flashcard.index < fcWords.length - 1 ? 'Next →' : 'Finish ✓'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Class Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setDeleteConfirmId(null)}>
          <div className="w-full max-w-md bg-[var(--surface)] rounded-t-3xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="w-9 h-1 rounded-full bg-[var(--border)] mx-auto" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-500/15 flex items-center justify-center text-xl shrink-0">🗑️</div>
              <div>
                <h2 className="font-bold text-lg text-[var(--text)]">Delete Class?</h2>
                <p className="text-xs text-[var(--text-muted)]">This will remove all members and data.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirmId(null)} className="flex-1 btn-ghost py-3 text-sm">Cancel</button>
              <button
                onClick={() => deleteClass(deleteConfirmId)}
                className="flex-1 py-3 rounded-2xl font-bold text-sm text-white bg-red-500 hover:bg-red-600 active:scale-95 transition-all"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-md bg-[var(--surface)] rounded-t-3xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="w-9 h-1 rounded-full bg-[var(--border)] mx-auto" />
            <h2 className="font-bold text-lg text-[var(--text)]">Create a Class</h2>
            <div>
              <label className="text-sm text-[var(--text-muted)] mb-1 block">Class name</label>
              <input
                type="text"
                placeholder="e.g. English B1 — Group A"
                value={className}
                onChange={e => setClassName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createClass()}
                autoFocus
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
              />
            </div>
            {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
            <p className="text-xs text-[var(--text-muted)]">A unique join code will be generated automatically.</p>
            <div className="flex gap-3">
              <button onClick={() => { setShowCreate(false); setError(''); }} className="flex-1 btn-ghost py-3 text-sm">Cancel</button>
              <button onClick={createClass} disabled={creating || !className.trim()} className="flex-1 btn-primary py-3 disabled:opacity-50">
                {creating ? 'Creating…' : 'Create Class'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

