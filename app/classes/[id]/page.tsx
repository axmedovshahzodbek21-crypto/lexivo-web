'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

const COLLECTION_TOTALS: Record<string, number> = { A1: 17, A2: 12, B1: 14, '30 Day': 30, '24 Vocab': 24, Mastery: 32 };
const TOTAL_UNITS = COLLECTION_TOTALS.A1 + COLLECTION_TOTALS.A2 + COLLECTION_TOTALS.B1;

const ACTIVITY_ICON: Record<string, string> = { learn: '📖', flashcard: '🃏', quiz: '🧠' };
const ACTIVITY_LABEL: Record<string, string> = { learn: 'Learn', flashcard: 'Flashcard', quiz: 'Quiz' };

type SortKey = 'lastActive' | 'xp' | 'progress' | 'name';
type FilterKey = 'all' | 'active' | 'inactive';
type Tab = 'students' | 'activity';

interface Announcement {
  id: string;
  message: string;
  created_at: string;
}

interface StudentRow {
  student_id: string;
  name: string;
  avatar_url: string | null;
  xp: number;
  streak: number;
  last_study_date: string | null;
  total_words: number;
  a1_learned: number;
  a2_learned: number;
  b1_learned: number;
  thirty_day_learned: number;
  twenty_four_learned: number;
  word_mastery_learned: number;
}

interface ClassInfo {
  id: string;
  name: string;
  join_code: string;
  teacher_id: string;
}

interface Note {
  id: string;
  message: string;
  created_at: string;
  read_at: string | null;
}

interface Target {
  id: string;
  title: string;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
}

interface ActivityRow {
  student_name: string;
  avatar_url: string | null;
  completion_type: string;
  collection_name: string;
  day_number: number;
  completed_at: string;
}

function Avatar({ name, url, size = 38 }: { name: string; url: string | null; size?: number }) {
  if (url) return <img src={url} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: size * 0.4 }}>
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  );
}

function lastActiveLabel(date: string | null): string {
  if (!date) return 'Never';
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (date >= today) return 'Today ✅';
  if (date >= yesterday) return 'Yesterday';
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
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

function isInactive(date: string | null): boolean {
  if (!date) return true;
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
  return date < threeDaysAgo;
}

function dayLabel(iso: string): string {
  const date = iso.slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (date === today) return 'Today';
  if (date === yesterday) return 'Yesterday';
  return new Date(date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function ProgressBar({ done, total, color }: { done: number; total: number; color: string }) {
  const pct = total === 0 ? 0 : Math.min(100, (done / total) * 100);
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--border)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[10px] text-[var(--text-muted)] whitespace-nowrap font-medium">{done}/{total}</span>
    </div>
  );
}

export default function ClassDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [notTeacher, setNotTeacher] = useState(false);
  const [tab, setTab] = useState<Tab>('students');

  // Sort & filter
  const [sortBy, setSortBy] = useState<SortKey>('lastActive');
  const [filterBy, setFilterBy] = useState<FilterKey>('all');

  // Notes state
  const [noteTarget, setNoteTarget] = useState<StudentRow | null>(null);
  const [noteText, setNoteText] = useState('');
  const [sending, setSending] = useState(false);
  const [studentNotes, setStudentNotes] = useState<Record<string, Note[]>>({});

  // Targets state
  const [targetStudent, setTargetStudent] = useState<StudentRow | null>(null);
  const [targetTitle, setTargetTitle] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [settingTarget, setSettingTarget] = useState(false);
  const [studentTargets, setStudentTargets] = useState<Record<string, Target[]>>({});

  // Activity feed
  const [activityFeed, setActivityFeed] = useState<ActivityRow[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // Announcements
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [showAnnounce, setShowAnnounce] = useState(false);
  const [announceText, setAnnounceText] = useState('');
  const [announcing, setAnnouncing] = useState(false);

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  const visibleStudents = useMemo(() => {
    let list = [...students];
    if (filterBy === 'active') list = list.filter(s => s.last_study_date && s.last_study_date >= sevenDaysAgo);
    else if (filterBy === 'inactive') list = list.filter(s => !s.last_study_date || s.last_study_date < sevenDaysAgo);
    list.sort((a, b) => {
      if (sortBy === 'xp') return b.xp - a.xp;
      if (sortBy === 'progress') return (b.a1_learned + b.a2_learned + b.b1_learned + b.thirty_day_learned + b.twenty_four_learned + b.word_mastery_learned) - (a.a1_learned + a.a2_learned + a.b1_learned + a.thirty_day_learned + a.twenty_four_learned + a.word_mastery_learned);
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (!a.last_study_date && !b.last_study_date) return 0;
      if (!a.last_study_date) return 1;
      if (!b.last_study_date) return -1;
      return b.last_study_date.localeCompare(a.last_study_date);
    });
    return list;
  }, [students, sortBy, filterBy]);

  const classStats = useMemo(() => {
    if (students.length === 0) return null;
    const n = students.length;
    const totalXP = students.reduce((s, r) => s + r.xp, 0);
    const avgStreak = students.reduce((s, r) => s + r.streak, 0) / n;
    const avgWords = students.reduce((s, r) => s + r.total_words, 0) / n;
    const activeCount = students.filter(r => r.last_study_date && r.last_study_date >= sevenDaysAgo).length;
    return { totalXP, avgStreak, avgWords, activeCount, n };
  }, [students]);

  // Group activity by calendar day
  const groupedActivity = useMemo(() => {
    const groups: { label: string; items: ActivityRow[] }[] = [];
    let currentLabel = '';
    for (const item of activityFeed) {
      const label = dayLabel(item.completed_at);
      if (label !== currentLabel) {
        groups.push({ label, items: [item] });
        currentLabel = label;
      } else {
        groups[groups.length - 1].items.push(item);
      }
    }
    return groups;
  }, [activityFeed]);

  const loadNotes = async () => {
    if (!id) return;
    const { data } = await supabase
      .from('class_notes')
      .select('id, student_id, message, created_at, read_at')
      .eq('class_id', id)
      .order('created_at', { ascending: false });
    if (!data) return;
    const map: Record<string, Note[]> = {};
    for (const n of data) {
      if (!map[n.student_id]) map[n.student_id] = [];
      map[n.student_id].push(n);
    }
    setStudentNotes(map);
  };

  const loadTargets = async () => {
    if (!id) return;
    const { data } = await supabase
      .from('class_targets')
      .select('id, student_id, title, due_date, completed_at, created_at')
      .eq('class_id', id)
      .order('created_at', { ascending: false });
    if (!data) return;
    const map: Record<string, Target[]> = {};
    for (const t of data) {
      if (!map[t.student_id]) map[t.student_id] = [];
      map[t.student_id].push(t);
    }
    setStudentTargets(map);
  };

  const loadAnnouncements = async () => {
    if (!id) return;
    const { data } = await supabase
      .from('class_announcements')
      .select('id, message, created_at')
      .eq('class_id', id)
      .order('created_at', { ascending: false });
    setAnnouncements((data as Announcement[]) ?? []);
  };

  const postAnnouncement = async () => {
    if (!user || !announceText.trim()) return;
    setAnnouncing(true);
    await supabase.from('class_announcements').insert({
      class_id: id,
      teacher_id: user.id,
      message: announceText.trim(),
    });
    setAnnounceText('');
    await loadAnnouncements();
    setAnnouncing(false);
  };

  const deleteAnnouncement = async (announcementId: string) => {
    await supabase.from('class_announcements').delete().eq('id', announcementId);
    setAnnouncements(prev => prev.filter(a => a.id !== announcementId));
  };

  const loadActivity = async () => {
    if (!id) return;
    setActivityLoading(true);
    const { data } = await supabase.rpc('get_class_activity', { p_class_id: id });
    setActivityFeed((data as ActivityRow[]) ?? []);
    setActivityLoading(false);
  };

  const load = async () => {
    if (!user || !id) return;
    setLoading(true);
    const { data: cls } = await supabase.from('classes').select('*').eq('id', id).single();
    if (!cls || cls.teacher_id !== user.id) { setNotTeacher(true); setLoading(false); return; }
    setClassInfo(cls);
    const { data } = await supabase.rpc('get_class_dashboard', { p_class_id: id });
    setStudents((data as StudentRow[]) ?? []);
    await Promise.all([loadNotes(), loadTargets(), loadAnnouncements()]);
    setLoading(false);
  };

  useEffect(() => { if (user) load(); else setLoading(false); }, [user, id]);
  useEffect(() => { if (tab === 'activity' && activityFeed.length === 0) loadActivity(); }, [tab]);

  const copyCode = () => {
    if (!classInfo) return;
    navigator.clipboard.writeText(classInfo.join_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportCSV = () => {
    const headers = ['Name', 'Last Active', 'XP', 'Streak', 'Words Learned', `A1 (/${COLLECTION_TOTALS.A1})`, `A2 (/${COLLECTION_TOTALS.A2})`, `B1 (/${COLLECTION_TOTALS.B1})`, `30 Day (/${COLLECTION_TOTALS['30 Day']})`, `24 Vocab (/${COLLECTION_TOTALS['24 Vocab']})`, `Mastery (/${COLLECTION_TOTALS.Mastery})`];
    const rows = students.map(s => [
      s.name, s.last_study_date ?? 'Never', s.xp, s.streak, s.total_words,
      s.a1_learned, s.a2_learned, s.b1_learned, s.thirty_day_learned, s.twenty_four_learned, s.word_mastery_learned,
    ]);
    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(classInfo?.name ?? 'class').replace(/[^a-z0-9]/gi, '-')}-progress-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const removeStudent = async (studentId: string) => {
    if (!confirm('Remove this student from the class?')) return;
    await supabase.from('class_members').delete().eq('class_id', id).eq('student_id', studentId);
    load();
  };

  const sendNote = async () => {
    if (!user || !noteTarget || !noteText.trim()) return;
    setSending(true);
    await supabase.from('class_notes').insert({ class_id: id, student_id: noteTarget.student_id, teacher_id: user.id, message: noteText.trim() });
    setNoteText('');
    await loadNotes();
    setSending(false);
  };

  const addTarget = async () => {
    if (!user || !targetStudent || !targetTitle.trim()) return;
    setSettingTarget(true);
    await supabase.from('class_targets').insert({ class_id: id, student_id: targetStudent.student_id, teacher_id: user.id, title: targetTitle.trim(), due_date: targetDate || null });
    setTargetTitle('');
    setTargetDate('');
    await loadTargets();
    setSettingTarget(false);
  };

  const deleteTarget = async (targetId: string) => {
    await supabase.from('class_targets').delete().eq('id', targetId);
    await loadTargets();
  };

  if (!user) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8">
      <div className="text-5xl">🔒</div>
      <p className="text-[var(--text-muted)]">Sign in to view this class</p>
      <button onClick={() => router.push('/login')} className="btn-primary">Sign in</button>
    </div>
  );

  if (notTeacher) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8">
      <div className="text-5xl">⛔</div>
      <p className="font-bold text-[var(--text)]">Not your class</p>
      <p className="text-sm text-[var(--text-muted)]">Only the teacher can view this dashboard</p>
      <button onClick={() => router.back()} className="btn-primary">Go back</button>
    </div>
  );

  const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: 'lastActive', label: '🕐 Active' },
    { key: 'xp', label: '⚡ XP' },
    { key: 'progress', label: '📈 Progress' },
    { key: 'name', label: '🔤 Name' },
  ];

  const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: '✅ Active' },
    { key: 'inactive', label: '😴 Inactive' },
  ];

  return (
    <div className="flex flex-col min-h-screen pb-24 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-[var(--border)]">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-lg shrink-0">←</button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-[var(--text)] truncate">{classInfo?.name ?? 'Class Dashboard'}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-[var(--text-muted)]">Join code:</span>
            <code className="text-xs font-bold text-[var(--primary)]">{classInfo?.join_code}</code>
            <button onClick={copyCode} className="text-sm hover:scale-110 transition-transform">{copied ? '✅' : '📋'}</button>
          </div>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          <p className="text-xl font-black text-[var(--primary)] leading-tight">{visibleStudents.length}<span className="text-sm text-[var(--text-muted)] font-normal">/{students.length}</span></p>
          <p className="text-[10px] text-[var(--text-muted)]">students</p>
          <div className="flex gap-1.5">
            <button onClick={() => router.push(`/classes/${id}/words`)} className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary-bg)] transition-colors">
              📝 Words
            </button>
            <button onClick={() => { setShowAnnounce(true); setAnnounceText(''); }} className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary-bg)] transition-colors">
              📢 Announce
            </button>
            {students.length > 0 && (
              <button onClick={exportCSV} className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary-bg)] transition-colors">
                📥 CSV
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tab switcher */}
      {!loading && (
        <div className="flex border-b border-[var(--border)]">
          {(['students', 'activity'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
                tab === t
                  ? 'border-b-2 border-[var(--primary)] text-[var(--primary)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {t === 'students' ? '👥 Students' : '📡 Activity'}
            </button>
          ))}
        </div>
      )}

      {/* Class stats bar — students tab only */}
      {!loading && tab === 'students' && classStats && (
        <div className="grid grid-cols-4 divide-x divide-[var(--border)] border-b border-[var(--border)]">
          {[
            { label: 'Total XP', value: classStats.totalXP.toLocaleString(), icon: '⚡' },
            { label: 'Avg streak', value: `${classStats.avgStreak.toFixed(1)}d`, icon: '🔥' },
            { label: 'Avg words', value: Math.round(classStats.avgWords).toString(), icon: '📚' },
            { label: 'Active', value: `${classStats.activeCount}/${classStats.n}`, icon: '✅' },
          ].map(stat => (
            <div key={stat.label} className="flex flex-col items-center py-2.5 px-1">
              <p className="text-base font-black text-[var(--text)] leading-tight">{stat.icon} {stat.value}</p>
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Sort & Filter bar — students tab only */}
      {!loading && tab === 'students' && students.length > 0 && (
        <div className="px-4 py-2.5 border-b border-[var(--border)] space-y-2">
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
            <span className="text-[10px] font-semibold text-[var(--text-muted)] shrink-0">Sort:</span>
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => setSortBy(opt.key)}
                className={`shrink-0 text-xs px-3 py-1 rounded-full font-medium transition-all ${sortBy === opt.key ? 'bg-[var(--primary)] text-white' : 'bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)]'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-[var(--text-muted)] shrink-0">Filter:</span>
            {FILTER_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => setFilterBy(opt.key)}
                className={`shrink-0 text-xs px-3 py-1 rounded-full font-medium transition-all ${filterBy === opt.key ? 'bg-[var(--primary)] text-white' : 'bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)]'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="p-4">
        {loading ? (
          <div className="flex justify-center py-12"><div className="text-4xl animate-bounce">📊</div></div>

        ) : tab === 'activity' ? (
          /* ── Activity feed ── */
          activityLoading ? (
            <div className="flex justify-center py-12"><div className="text-4xl animate-bounce">📡</div></div>
          ) : activityFeed.length === 0 ? (
            <div className="card text-center py-12 space-y-3">
              <div className="text-5xl">📡</div>
              <p className="font-bold text-[var(--text)]">No activity yet</p>
              <p className="text-sm text-[var(--text-muted)]">Activity appears here as students complete units</p>
            </div>
          ) : (
            <div className="space-y-5">
              {groupedActivity.map(group => (
                <div key={group.label}>
                  <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide mb-2">{group.label}</p>
                  <div className="space-y-2">
                    {group.items.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 py-2.5 px-3 rounded-xl" style={{ background: 'var(--surface-2)' }}>
                        <Avatar name={item.student_name} url={item.avatar_url} size={34} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[var(--text)] leading-tight">
                            <span className="font-semibold">{item.student_name}</span>
                            {' '}completed {ACTIVITY_ICON[item.completion_type]}{' '}
                            <span className="font-medium">{ACTIVITY_LABEL[item.completion_type]}</span>
                            {' · '}<span className="text-[var(--text-muted)]">{item.collection_name} Unit {item.day_number}</span>
                          </p>
                          <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{timeAgo(item.completed_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )

        ) : (
          /* ── Students tab ── */
          students.length === 0 ? (
            <div className="card text-center py-12 space-y-3">
              <div className="text-5xl">👥</div>
              <p className="font-bold text-[var(--text)]">No students yet</p>
              <p className="text-sm text-[var(--text-muted)]">Share this code with your students:</p>
              <div className="flex items-center justify-center gap-2">
                <code className="text-xl font-black text-[var(--primary)] bg-[var(--primary-bg)] px-5 py-2.5 rounded-xl tracking-wider">{classInfo?.join_code}</code>
                <button onClick={copyCode} className="text-2xl">{copied ? '✅' : '📋'}</button>
              </div>
            </div>
          ) : visibleStudents.length === 0 ? (
            <div className="card text-center py-10 space-y-2">
              <div className="text-4xl">😴</div>
              <p className="font-bold text-[var(--text)]">No inactive students</p>
              <p className="text-sm text-[var(--text-muted)]">Everyone studied in the last 7 days!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleStudents.map((s, i) => {
                const notes = studentNotes[s.student_id] ?? [];
                const unreadNotes = notes.filter(n => !n.read_at).length;
                const targets = studentTargets[s.student_id] ?? [];
                const activeTargets = targets.filter(t => !t.completed_at).length;
                const totalProgress = s.a1_learned + s.a2_learned + s.b1_learned;
                return (
                  <div key={s.student_id} className="card space-y-3" style={isInactive(s.last_study_date) ? { borderLeft: '3px solid var(--danger)', background: 'color-mix(in srgb, var(--danger) 4%, var(--surface))' } : {}}>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-[var(--text-muted)] w-5 text-center shrink-0">{i + 1}</span>
                      <Avatar name={s.name} url={s.avatar_url} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-sm text-[var(--text)] truncate">{s.name}</p>
                          {isInactive(s.last_study_date) && <span className="text-[10px] font-bold text-[var(--danger)] shrink-0">⚠️ Inactive</span>}
                        </div>
                        <p className="text-xs text-[var(--text-muted)]">Last active: {lastActiveLabel(s.last_study_date)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-black text-[var(--primary)]">{s.xp} XP</p>
                        <p className="text-[10px] text-[var(--text-muted)]">🔥 {s.streak} · 📚 {s.total_words}</p>
                      </div>
                    </div>

                    <div className="pl-8">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold text-[var(--text-muted)]">Overall progress</span>
                        <span className="text-[10px] font-bold text-[var(--text-muted)]">{totalProgress}/{TOTAL_UNITS} units</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (totalProgress / TOTAL_UNITS) * 100)}%`, background: 'linear-gradient(90deg, #2ECC71, #3498DB)' }} />
                      </div>
                    </div>

                    <div className="pl-8 space-y-2">
                      <p className="text-[10px] font-semibold text-[var(--text-muted)]">Foundation</p>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: 'A1', done: s.a1_learned, color: '#2ECC71' },
                          { label: 'A2', done: s.a2_learned, color: '#27AE60' },
                          { label: 'B1', done: s.b1_learned, color: '#3498DB' },
                        ].map(({ label, done, color }) => (
                          <div key={label}>
                            <p className="text-[10px] font-bold text-[var(--text-muted)] mb-1">{label}</p>
                            <ProgressBar done={done} total={COLLECTION_TOTALS[label]} color={color} />
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] font-semibold text-[var(--text-muted)] pt-1">Challenges</p>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: '30 Day', done: s.thirty_day_learned, color: '#6C63FF' },
                          { label: '24 Vocab', done: s.twenty_four_learned, color: '#FF6584' },
                          { label: 'Mastery', done: s.word_mastery_learned, color: '#F39C12' },
                        ].map(({ label, done, color }) => (
                          <div key={label}>
                            <p className="text-[10px] font-bold text-[var(--text-muted)] mb-1">{label}</p>
                            <ProgressBar done={done} total={COLLECTION_TOTALS[label]} color={color} />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 pl-8">
                      <button onClick={() => { setNoteTarget(s); setNoteText(''); }} className="flex items-center gap-1.5 text-xs font-semibold text-[var(--primary)] hover:opacity-70 transition-opacity">
                        ✉️ Note
                        {unreadNotes > 0 && <span className="bg-[var(--primary)] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{unreadNotes}</span>}
                      </button>
                      <button onClick={() => { setTargetStudent(s); setTargetTitle(''); setTargetDate(''); }} className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors">
                        🎯 Target
                        {activeTargets > 0 && <span className="bg-[var(--surface-2)] text-[var(--text-muted)] text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-[var(--border)]">{activeTargets}</span>}
                      </button>
                      <button onClick={() => removeStudent(s.student_id)} className="text-[10px] text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors ml-auto">Remove</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* Note modal */}
      {noteTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setNoteTarget(null)}>
          <div className="w-full max-w-md bg-[var(--surface)] rounded-t-3xl p-5 space-y-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="w-9 h-1 rounded-full bg-[var(--border)] mx-auto shrink-0" />
            <div className="flex items-center gap-3 shrink-0">
              <Avatar name={noteTarget.name} url={noteTarget.avatar_url} size={36} />
              <div><p className="font-bold text-[var(--text)]">{noteTarget.name}</p><p className="text-xs text-[var(--text-muted)]">Send a note</p></div>
            </div>
            {(studentNotes[noteTarget.student_id] ?? []).length > 0 && (
              <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                <p className="text-xs font-semibold text-[var(--text-muted)]">Previous notes</p>
                {(studentNotes[noteTarget.student_id] ?? []).map(n => (
                  <div key={n.id} className="rounded-xl px-3 py-2.5 text-sm" style={{ background: 'var(--surface-2)' }}>
                    <p className="text-[var(--text)]">{n.message}</p>
                    <p className="text-[10px] text-[var(--text-muted)] mt-1">{timeAgo(n.created_at)} {n.read_at ? '· Seen ✓' : '· Not seen yet'}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="shrink-0 space-y-3">
              <textarea placeholder={`Write a note to ${noteTarget.name}…`} value={noteText} onChange={e => setNoteText(e.target.value)} rows={3} autoFocus className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] text-sm resize-none focus:outline-none focus:border-[var(--primary)]" />
              <div className="flex gap-3">
                <button onClick={() => setNoteTarget(null)} className="flex-1 py-3 rounded-xl bg-[var(--surface-2)] text-sm font-semibold text-[var(--text)]">Cancel</button>
                <button onClick={sendNote} disabled={sending || !noteText.trim()} className="flex-1 btn-primary py-3 disabled:opacity-50">{sending ? 'Sending…' : 'Send ✉️'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Announce modal */}
      {showAnnounce && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setShowAnnounce(false)}>
          <div className="w-full max-w-md bg-[var(--surface)] rounded-t-3xl p-5 space-y-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="w-9 h-1 rounded-full bg-[var(--border)] mx-auto shrink-0" />
            <div className="flex items-center justify-between shrink-0">
              <div>
                <p className="font-bold text-[var(--text)]">📢 Class Announcement</p>
                <p className="text-xs text-[var(--text-muted)]">Sent to all students in {classInfo?.name}</p>
              </div>
            </div>

            {/* Past announcements */}
            {announcements.length > 0 && (
              <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                <p className="text-xs font-semibold text-[var(--text-muted)]">Past announcements</p>
                {announcements.map(a => (
                  <div key={a.id} className="rounded-xl px-3 py-2.5 flex items-start gap-2" style={{ background: 'var(--surface-2)' }}>
                    <p className="flex-1 text-sm text-[var(--text)]">{a.message}</p>
                    <div className="text-right shrink-0 space-y-1">
                      <p className="text-[10px] text-[var(--text-muted)]">{timeAgo(a.created_at)}</p>
                      <button onClick={() => deleteAnnouncement(a.id)} className="text-[10px] text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors block">✕ Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Compose */}
            <div className="shrink-0 space-y-3">
              <textarea
                placeholder="Write an announcement for all students…"
                value={announceText}
                onChange={e => setAnnounceText(e.target.value)}
                rows={3}
                autoFocus
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] text-sm resize-none focus:outline-none focus:border-[var(--primary)]"
              />
              <div className="flex gap-3">
                <button onClick={() => setShowAnnounce(false)} className="flex-1 py-3 rounded-xl bg-[var(--surface-2)] text-sm font-semibold text-[var(--text)]">Cancel</button>
                <button onClick={postAnnouncement} disabled={announcing || !announceText.trim()} className="flex-1 btn-primary py-3 disabled:opacity-50">
                  {announcing ? 'Posting…' : 'Post 📢'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Target modal */}
      {targetStudent && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setTargetStudent(null)}>
          <div className="w-full max-w-md bg-[var(--surface)] rounded-t-3xl p-5 space-y-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="w-9 h-1 rounded-full bg-[var(--border)] mx-auto shrink-0" />
            <div className="flex items-center gap-3 shrink-0">
              <Avatar name={targetStudent.name} url={targetStudent.avatar_url} size={36} />
              <div><p className="font-bold text-[var(--text)]">{targetStudent.name}</p><p className="text-xs text-[var(--text-muted)]">Set a target</p></div>
            </div>
            {(studentTargets[targetStudent.student_id] ?? []).length > 0 && (
              <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                <p className="text-xs font-semibold text-[var(--text-muted)]">Active targets</p>
                {(studentTargets[targetStudent.student_id] ?? []).map(t => {
                  const due = dueDateLabel(t.due_date);
                  return (
                    <div key={t.id} className="flex items-start gap-3 rounded-xl px-3 py-2.5" style={{ background: 'var(--surface-2)' }}>
                      <span className="text-base mt-0.5 shrink-0">{t.completed_at ? '✅' : '🎯'}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm text-[var(--text)] ${t.completed_at ? 'line-through opacity-50' : ''}`}>{t.title}</p>
                        {due && <p className={`text-[10px] mt-0.5 font-medium ${due.overdue && !t.completed_at ? 'text-[var(--danger)]' : 'text-[var(--text-muted)]'}`}>{t.completed_at ? `Completed ${timeAgo(t.completed_at)}` : due.text}</p>}
                        {t.completed_at && !due && <p className="text-[10px] mt-0.5 text-[var(--text-muted)]">Completed {timeAgo(t.completed_at)}</p>}
                      </div>
                      <button onClick={() => deleteTarget(t.id)} className="text-[10px] text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors shrink-0 mt-1">✕</button>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="shrink-0 space-y-3">
              <input type="text" placeholder='e.g. "Complete A1 Unit 5 by Friday"' value={targetTitle} onChange={e => setTargetTitle(e.target.value)} autoFocus className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] text-sm focus:outline-none focus:border-[var(--primary)]" />
              <div>
                <label className="text-xs text-[var(--text-muted)] mb-1 block">Due date (optional)</label>
                <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} min={new Date().toISOString().slice(0, 10)} className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] text-sm focus:outline-none focus:border-[var(--primary)]" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setTargetStudent(null)} className="flex-1 py-3 rounded-xl bg-[var(--surface-2)] text-sm font-semibold text-[var(--text)]">Cancel</button>
                <button onClick={addTarget} disabled={settingTarget || !targetTitle.trim()} className="flex-1 btn-primary py-3 disabled:opacity-50">{settingTarget ? 'Setting…' : 'Set target 🎯'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
