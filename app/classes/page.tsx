'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

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

export default function ClassesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [myClasses, setMyClasses] = useState<ClassRow[]>([]);
  const [joinedClasses, setJoinedClasses] = useState<ClassRow[]>([]);
  const [classNotes, setClassNotes] = useState<Record<string, Note[]>>({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [className, setClassName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState('');
  const [joinError, setJoinError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadNotes = async (userId: string) => {
    const { data } = await supabase
      .from('class_notes')
      .select('id, class_id, message, created_at, read_at')
      .eq('student_id', userId)
      .order('created_at', { ascending: false });
    if (!data || data.length === 0) return;

    const map: Record<string, Note[]> = {};
    for (const n of data) {
      if (!map[n.class_id]) map[n.class_id] = [];
      map[n.class_id].push(n);
    }
    setClassNotes(map);

    // Mark unread notes as read
    const unreadIds = data.filter((n: Note) => !n.read_at).map((n: Note) => n.id);
    if (unreadIds.length > 0) {
      await supabase
        .from('class_notes')
        .update({ read_at: new Date().toISOString() })
        .in('id', unreadIds);
    }
  };

  const load = async () => {
    if (!user) return;
    setLoading(true);

    // Classes I teach
    const { data: taught } = await supabase
      .from('classes')
      .select('*')
      .eq('teacher_id', user.id)
      .order('created_at', { ascending: false });

    const taughtWithCounts: ClassRow[] = [];
    for (const cls of taught ?? []) {
      const { count } = await supabase
        .from('class_members')
        .select('*', { count: 'exact', head: true })
        .eq('class_id', cls.id);
      taughtWithCounts.push({ ...cls, member_count: count ?? 0 });
    }
    setMyClasses(taughtWithCounts);

    // Classes I joined as student
    const { data: memberships } = await supabase
      .from('class_members')
      .select('class_id')
      .eq('student_id', user.id);

    let joined: ClassRow[] = [];
    if (memberships && memberships.length > 0) {
      const classIds = memberships.map((m: { class_id: string }) => m.class_id);
      const { data } = await supabase
        .from('classes')
        .select('*')
        .in('id', classIds);
      joined = (data ?? []).filter((c: ClassRow) => c.teacher_id !== user.id);
    }
    setJoinedClasses(joined);

    if (joined.length > 0) {
      await loadNotes(user.id);
    }

    setLoading(false);
  };

  useEffect(() => { if (user) load(); else setLoading(false); }, [user]);

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
    if (err) {
      setError('Failed to create class. Please try again.');
    } else {
      setClassName('');
      setShowCreate(false);
      load();
    }
    setCreating(false);
  };

  const joinClass = async () => {
    if (!user || !joinCode.trim()) return;
    setJoinError('');
    const code = joinCode.trim().toUpperCase();
    const { data: cls } = await supabase
      .from('classes')
      .select('id, teacher_id')
      .eq('join_code', code)
      .single();

    if (!cls) { setJoinError('Class not found. Check the code and try again.'); return; }
    if (cls.teacher_id === user.id) { setJoinError("You can't join your own class as a student."); return; }

    const { error: err } = await supabase.from('class_members').insert({
      class_id: cls.id,
      student_id: user.id,
    });
    if (err) {
      if (err.code === '23505') setJoinError('You are already in this class.');
      else setJoinError('Failed to join. Please try again.');
    } else {
      setJoinCode('');
      load();
    }
  };

  const leaveClass = async (classId: string) => {
    if (!user) return;
    await supabase.from('class_members').delete().eq('class_id', classId).eq('student_id', user.id);
    load();
  };

  const deleteClass = async (classId: string) => {
    if (!confirm('Delete this class? All students will be removed.')) return;
    await supabase.from('classes').delete().eq('id', classId);
    load();
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
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

  return (
    <div className="flex flex-col min-h-screen pb-24 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-[var(--border)]">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-lg">←</button>
        <div className="flex-1">
          <h1 className="font-bold text-[var(--text)]">👩‍🏫 Classes</h1>
          <p className="text-xs text-[var(--text-muted)]">Create or join a class</p>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {loading ? (
          <div className="flex justify-center py-12"><div className="text-4xl animate-bounce">👩‍🏫</div></div>
        ) : (
          <>
            {/* My Classes (Teacher) */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-[var(--text)]">My Classes</h2>
                <button onClick={() => setShowCreate(true)} className="btn-primary text-sm px-3 py-1.5">
                  + Create
                </button>
              </div>

              {myClasses.length === 0 ? (
                <div className="card text-center py-8 space-y-2">
                  <div className="text-4xl">📋</div>
                  <p className="text-sm text-[var(--text-muted)]">No classes yet. Create one to track your students.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {myClasses.map(cls => (
                    <div key={cls.id} className="card">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[var(--text)]">{cls.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-[var(--text-muted)]">Code:</span>
                            <code className="text-xs font-bold text-[var(--primary)] bg-[var(--primary-bg)] px-2 py-0.5 rounded-lg">
                              {cls.join_code}
                            </code>
                            <button
                              onClick={() => copyCode(cls.join_code, cls.id)}
                              className="text-sm hover:scale-110 transition-transform"
                              title="Copy code"
                            >
                              {copiedId === cls.id ? '✅' : '📋'}
                            </button>
                          </div>
                          <p className="text-xs text-[var(--text-muted)] mt-1">
                            👥 {cls.member_count} student{cls.member_count !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                          <button
                            onClick={() => router.push(`/classes/${cls.id}`)}
                            className="btn-primary text-xs px-3 py-1.5"
                          >
                            Dashboard →
                          </button>
                          <button
                            onClick={() => deleteClass(cls.id)}
                            className="text-xs px-3 py-1.5 rounded-xl bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Join a Class */}
            <section>
              <h2 className="font-bold text-[var(--text)] mb-3">Join a Class</h2>
              <div className="card space-y-3">
                <p className="text-sm text-[var(--text-muted)]">Enter the code your teacher gave you</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. LEXI-8X2K"
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === 'Enter' && joinClass()}
                    className="flex-1 px-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] text-sm font-mono focus:outline-none focus:border-[var(--primary)]"
                    maxLength={9}
                  />
                  <button onClick={joinClass} className="btn-primary text-sm px-4">Join</button>
                </div>
                {joinError && <p className="text-xs text-[var(--danger)]">{joinError}</p>}
              </div>
            </section>

            {/* Classes I'm a student in */}
            {joinedClasses.length > 0 && (
              <section>
                <h2 className="font-bold text-[var(--text)] mb-3">Classes I&apos;ve Joined</h2>
                <div className="space-y-3">
                  {joinedClasses.map(cls => {
                    const notes = classNotes[cls.id] ?? [];
                    const unreadCount = notes.filter(n => !n.read_at).length;
                    return (
                      <div key={cls.id} className="card space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-[var(--text)]">{cls.name}</p>
                              {unreadCount > 0 && (
                                <span className="bg-[var(--primary)] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
                                  {unreadCount} new
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[var(--text-muted)] mt-0.5">Code: {cls.join_code}</p>
                          </div>
                          <button
                            onClick={() => leaveClass(cls.id)}
                            className="text-xs px-3 py-1.5 rounded-xl bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors shrink-0"
                          >
                            Leave
                          </button>
                        </div>

                        {/* Notes from teacher */}
                        {notes.length > 0 && (
                          <div className="space-y-2 border-t border-[var(--border)] pt-3">
                            <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">Notes from teacher</p>
                            {notes.map(note => (
                              <div
                                key={note.id}
                                className="rounded-xl px-3 py-2.5 text-sm transition-colors"
                                style={{
                                  background: note.read_at ? 'var(--surface-2)' : 'var(--primary-bg)',
                                  borderLeft: note.read_at ? 'none' : '3px solid var(--primary)',
                                }}
                              >
                                <div className="flex items-start gap-2">
                                  <span className="text-base shrink-0 mt-0.5">✉️</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[var(--text)] leading-snug">{note.message}</p>
                                    <p className="text-[10px] text-[var(--text-muted)] mt-1">{timeAgo(note.created_at)}</p>
                                  </div>
                                  {!note.read_at && (
                                    <span className="text-[10px] font-bold text-[var(--primary)] shrink-0 mt-0.5">NEW</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* Create Class Modal */}
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
              <button onClick={() => { setShowCreate(false); setError(''); }} className="flex-1 py-3 rounded-xl bg-[var(--surface-2)] text-sm font-semibold text-[var(--text)]">
                Cancel
              </button>
              <button
                onClick={createClass}
                disabled={creating || !className.trim()}
                className="flex-1 btn-primary py-3 disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Create Class'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
