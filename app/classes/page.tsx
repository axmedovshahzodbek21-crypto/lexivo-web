'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import BackButton from '@/components/BackButton';
import { createClass as createClassRow } from '@/lib/class-create';

interface ClassWord { word: string; translation: string; classId: string; className: string; }

export default function ClassesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [createdCount, setCreatedCount] = useState<number | null>(null);
  const [joinedCount, setJoinedCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'words'>('overview');

  const [showCreate, setShowCreate] = useState(false);
  const [className, setClassName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');

  const [myWords, setMyWords] = useState<ClassWord[]>([]);
  const [wordsLoading, setWordsLoading] = useState(false);
  const [wordsLoaded, setWordsLoaded] = useState(false);
  const [wordSearch, setWordSearch] = useState('');

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    loadCounts();
  }, [user?.id]);

  useEffect(() => {
    if (activeTab === 'words' && !wordsLoaded && user) loadWords();
  }, [activeTab, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadCounts = async () => {
    if (!user) return;
    const [{ count: c }, { count: j }] = await Promise.all([
      supabase.from('classes').select('id', { count: 'exact', head: true }).eq('teacher_id', user.id),
      supabase.from('class_members').select('class_id', { count: 'exact', head: true }).eq('student_id', user.id),
    ]);
    setCreatedCount(c ?? 0);
    setJoinedCount(j ?? 0);
    setLoading(false);
  };

  const loadWords = async () => {
    if (!user) return;
    setWordsLoading(true);
    const { data: srsRows } = await supabase
      .from('class_srs_states')
      .select('word, translation, class_id')
      .eq('user_id', user.id)
      .order('word');
    if (!srsRows?.length) { setMyWords([]); setWordsLoading(false); setWordsLoaded(true); return; }
    const classIds = [...new Set(srsRows.map(r => r.class_id as string))];
    const { data: classRows } = await supabase.from('classes').select('id, name').in('id', classIds);
    const nameMap = Object.fromEntries((classRows ?? []).map(c => [c.id, c.name as string]));
    setMyWords(srsRows.map(r => ({
      word: r.word as string,
      translation: r.translation as string,
      classId: r.class_id as string,
      className: nameMap[r.class_id as string] ?? 'Unknown class',
    })));
    setWordsLoading(false);
    setWordsLoaded(true);
  };

  const createClass = async () => {
    if (!user || !className.trim()) return;
    setCreating(true); setCreateError('');
    const { error: err } = await createClassRow(className.trim(), user.id);
    if (err) { setCreateError('Failed to create class.'); setCreating(false); return; }
    setClassName(''); setShowCreate(false); setCreating(false);
    router.push('/classes/created');
  };

  const joinClass = async () => {
    if (!user || !joinCode.trim()) return;
    setJoinError('');
    const code = joinCode.trim().toUpperCase();
    const { data: cls } = await supabase.from('classes').select('id, teacher_id').eq('join_code', code).single();
    if (!cls) { setJoinError('Class not found. Check the code and try again.'); return; }
    if (cls.teacher_id === user.id) { setJoinError("You can't join your own class."); return; }
    const { error: err } = await supabase.from('class_members').insert({ class_id: cls.id, student_id: user.id });
    if (err) { setJoinError(err.code === '23505' ? 'Already in this class.' : 'Failed to join.'); return; }
    setJoinCode(''); setShowJoin(false);
    router.push('/classes/joined');
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8">
        <div className="text-5xl">🏫</div>
        <h1 className="text-xl font-bold text-[var(--text)]">Classes</h1>
        <p className="text-[var(--text-muted)] text-center">Sign in to create or join a class</p>
        <button onClick={() => router.push('/login')} className="btn-primary">Sign in</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen animate-fade-in">
      {/* Gradient hero header */}
      <div
        className="relative px-5 pt-5 pb-7"
        style={{
          background: 'linear-gradient(135deg, #A78BFA 0%, #6C63FF 50%, #4C1D95 100%)',
          boxShadow: '0 8px 32px rgba(108,99,255,0.35)',
        }}
      >
        {/* Watermark */}
        <div style={{
          position: 'absolute', right: 16, top: 8,
          fontSize: 96, fontWeight: 900,
          color: 'rgba(255,255,255,0.05)',
          lineHeight: 1, userSelect: 'none', pointerEvents: 'none',
        }}>🏫</div>

        <BackButton className="mb-4" />
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
            style={{ background: 'rgba(255,255,255,0.18)', boxShadow: '0 4px 0 rgba(0,0,0,0.15)' }}
          >🏫</div>
          <div>
            <p className="text-xs font-black text-white/50 uppercase tracking-widest mb-0.5">Lexivo</p>
            <h1 className="text-2xl font-black text-white leading-tight" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.25)' }}>
              Classes
            </h1>
          </div>
        </div>
        <p className="text-sm text-white/65 mt-2 ml-0.5">Create or join a class with your teacher or students.</p>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-[var(--border)] px-4">
        {(['overview', 'words'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="py-3 px-4 text-sm font-semibold transition-colors relative"
            style={{ color: activeTab === tab ? 'var(--primary)' : 'var(--text-muted)' }}
          >
            {tab === 'overview' ? 'Overview' : `My Words${myWords.length > 0 ? ` (${myWords.length})` : ''}`}
            {activeTab === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ background: 'var(--primary)' }} />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 flex flex-col gap-4 p-4 max-w-lg mx-auto w-full">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : activeTab === 'overview' ? (
          <>
            {/* My Classes card */}
            <button
              onClick={() => router.push('/classes/created')}
              className="group w-full rounded-3xl text-left transition-all duration-200 hover:-translate-y-1 active:translate-y-0"
              style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', boxShadow: '0 8px 0 rgba(79,50,220,0.5), 0 16px 40px rgba(99,60,255,0.3)' }}
            >
              <div className="p-6 flex items-center gap-5">
                <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center text-3xl shrink-0">🏫</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xl font-black text-white">My Classes</p>
                  <p className="text-sm text-white/60 mt-0.5">
                    {createdCount === 0 ? 'No classes yet' : `${createdCount} class${createdCount !== 1 ? 'es' : ''} created`}
                  </p>
                </div>
                <span className="text-2xl text-white/50 group-hover:text-white/90 transition-colors">→</span>
              </div>
            </button>

            {/* Joined Classes card */}
            <button
              onClick={() => router.push('/classes/joined')}
              className="group w-full rounded-3xl text-left transition-all duration-200 hover:-translate-y-1 active:translate-y-0"
              style={{ background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)', boxShadow: '0 8px 0 rgba(10,160,100,0.5), 0 16px 40px rgba(16,180,130,0.3)' }}
            >
              <div className="p-6 flex items-center gap-5">
                <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center text-3xl shrink-0">🎓</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xl font-black text-white">Joined Classes</p>
                  <p className="text-sm text-white/60 mt-0.5">
                    {joinedCount === 0 ? 'Not enrolled yet' : `${joinedCount} class${joinedCount !== 1 ? 'es' : ''} joined`}
                  </p>
                </div>
                <span className="text-2xl text-white/50 group-hover:text-white/90 transition-colors">→</span>
              </div>
            </button>

            {/* Action buttons */}
            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setShowCreate(true)}
                className="flex-1 py-4 rounded-2xl font-black text-sm text-white transition-all hover:-translate-y-0.5 active:translate-y-0"
                style={{ background: 'linear-gradient(135deg, var(--primary) 0%, #9333ea 100%)', boxShadow: '0 5px 0 rgba(80,30,200,0.5)' }}
              >
                + Create Class
              </button>
              <button
                onClick={() => setShowJoin(true)}
                className="flex-1 py-4 rounded-2xl font-black text-sm text-white transition-all hover:-translate-y-0.5 active:translate-y-0"
                style={{ background: 'linear-gradient(135deg, #10b981, #0891b2)', boxShadow: '0 5px 0 rgba(7,120,100,0.55), 0 8px 20px rgba(16,185,129,0.25)' }}
              >
                Join a Class
              </button>
            </div>
          </>
        ) : (
          /* ── My Words tab ── */
          <>
            {wordsLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : myWords.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-16">
                <span className="text-5xl">📚</span>
                <p className="font-bold text-[var(--text)]">No words yet</p>
                <p className="text-sm text-[var(--text-muted)]">Complete Learn mode in a class or homework to see your words here.</p>
              </div>
            ) : (
              <>
                {/* Search */}
                <input
                  type="text"
                  placeholder="Search words…"
                  value={wordSearch}
                  onChange={e => setWordSearch(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] text-sm focus:outline-none focus:border-[var(--primary)]"
                />

                {/* Grouped by class */}
                {(() => {
                  const q = wordSearch.toLowerCase();
                  const filtered = myWords.filter(w =>
                    !q || w.word.toLowerCase().includes(q) || w.translation.toLowerCase().includes(q)
                  );
                  const grouped = filtered.reduce<Record<string, { name: string; words: ClassWord[] }>>((acc, w) => {
                    if (!acc[w.classId]) acc[w.classId] = { name: w.className, words: [] };
                    acc[w.classId].words.push(w);
                    return acc;
                  }, {});

                  if (filtered.length === 0) return (
                    <p className="text-center text-sm text-[var(--text-muted)] py-8">No matches for &ldquo;{wordSearch}&rdquo;</p>
                  );

                  return Object.entries(grouped).map(([classId, group]) => (
                    <div key={classId}>
                      <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2">
                        {group.name} · {group.words.length} word{group.words.length !== 1 ? 's' : ''}
                      </p>
                      <div className="space-y-1.5">
                        {group.words.map((w, i) => (
                          <div key={i} className="flex items-center gap-3 p-2.5 bg-[var(--surface)] rounded-xl border border-[var(--border)]">
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-sm text-[var(--text)]">{w.word}</p>
                              <p className="text-xs text-[var(--primary)] font-medium mt-0.5">{w.translation}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ));
                })()}
              </>
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
                type="text" autoFocus
                placeholder="e.g. English B1 — Group A"
                value={className}
                onChange={e => setClassName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createClass()}
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
              />
            </div>
            {createError && <p className="text-sm text-[var(--danger)]">{createError}</p>}
            <p className="text-xs text-[var(--text-muted)]">A unique join code will be generated automatically.</p>
            <div className="flex gap-3">
              <button onClick={() => { setShowCreate(false); setCreateError(''); }} className="flex-1 btn-ghost py-3 text-sm">Cancel</button>
              <button onClick={createClass} disabled={creating || !className.trim()} className="flex-1 btn-primary py-3 disabled:opacity-50">
                {creating ? 'Creating…' : 'Create Class'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join Class Modal */}
      {showJoin && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setShowJoin(false)}>
          <div className="w-full max-w-md bg-[var(--surface)] rounded-t-3xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="w-9 h-1 rounded-full bg-[var(--border)] mx-auto" />
            <h2 className="font-bold text-lg text-[var(--text)]">Join a Class</h2>
            <div>
              <label className="text-sm text-[var(--text-muted)] mb-1 block">Class code</label>
              <input
                type="text" autoFocus
                placeholder="e.g. LEXI-8X2K"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && joinClass()}
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] font-mono focus:outline-none focus:border-[var(--primary)]"
                maxLength={9}
              />
            </div>
            {joinError && <p className="text-sm text-[var(--danger)]">{joinError}</p>}
            <div className="flex gap-3">
              <button onClick={() => { setShowJoin(false); setJoinError(''); setJoinCode(''); }} className="flex-1 btn-ghost py-3 text-sm">Cancel</button>
              <button onClick={joinClass} disabled={!joinCode.trim()} className="flex-1 btn-primary py-3 disabled:opacity-50">Join →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
