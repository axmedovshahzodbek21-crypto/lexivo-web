'use client';
import { SectionLoader } from '@/components/Loader';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import BackButton from '@/components/BackButton';
import { createClass as createClassRow } from '@/lib/class-create';
import { classGradientColors } from '@/lib/class-gradient';

interface ClassRow {
  id: string;
  name: string;
  join_code: string;
  teacher_id: string;
  created_at: string;
  member_count?: number;
}


const _cache = new Map<string, ClassRow[]>();

export default function CreatedClassesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [myClasses, setMyClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [className, setClassName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => { if (user) load(); else setLoading(false); }, [user?.id]);

  const load = async () => {
    if (!user) return;
    const cached = _cache.get(user.id);
    if (cached) { setMyClasses(cached); setLoading(false); }
    else setLoading(true);

    const { data: taught } = await supabase
      .from('classes').select('*').eq('teacher_id', user.id).order('created_at', { ascending: false });

    const taughtIds = (taught ?? []).map((c: ClassRow) => c.id);
    let classes: ClassRow[] = [];
    if (taughtIds.length > 0) {
      const { data: memberRows } = await supabase.from('class_members').select('class_id').in('class_id', taughtIds).eq('status', 'approved');
      const countMap: Record<string, number> = {};
      for (const m of memberRows ?? []) countMap[m.class_id] = (countMap[m.class_id] ?? 0) + 1;
      classes = (taught ?? []).map((c: ClassRow) => ({ ...c, member_count: countMap[c.id] ?? 0 }));
    }
    _cache.set(user.id, classes);
    setMyClasses(classes);
    setLoading(false);
  };

  const createClass = async () => {
    if (!user || !className.trim()) return;
    setCreating(true); setCreateError('');
    const { error: err } = await createClassRow(className.trim(), user.id);
    if (err) { setCreateError('Failed to create class.'); setCreating(false); return; }
    setClassName(''); setShowCreate(false); setCreating(false);
    _cache.delete(user.id); load();
  };

  const deleteClass = async (classId: string) => {
    if (!user) return;
    try {
      await supabase.from('classes').delete().eq('id', classId);
    } catch (e) {
      alert(`Failed to delete class: ${e instanceof Error ? e.message : e}`);
      return;
    }
    setDeleteConfirmId(null);
    _cache.delete(user.id); load();
  };

  const saveRename = async (classId: string) => {
    if (!renameText.trim()) return;
    setRenaming(true);
    try {
      await supabase.from('classes').update({ name: renameText.trim() }).eq('id', classId);
    } catch (e) {
      alert(`Failed to rename class: ${e instanceof Error ? e.message : e}`);
      setRenaming(false);
      return;
    }
    setRenamingId(null); setRenaming(false);
    if (user) _cache.delete(user.id); load();
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id); setTimeout(() => setCopiedId(null), 2000);
  };

  const copyLink = (code: string, id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/join/${code}`);
    setCopiedLinkId(id); setTimeout(() => setCopiedLinkId(null), 2000);
  };

  return (
    <div className="flex flex-col min-h-screen pb-24 animate-fade-in">
      {/* Gradient hero header */}
      <div
        className="relative px-5 pt-5 pb-7"
        style={{
          background: 'linear-gradient(135deg, #A78BFA 0%, #6C63FF 50%, #4C1D95 100%)',
          boxShadow: '0 8px 32px rgba(108,99,255,0.35)',
        }}
      >
        <div style={{ position: 'absolute', right: 16, top: 8, fontSize: 96, fontWeight: 900, color: 'rgba(255,255,255,0.05)', lineHeight: 1, userSelect: 'none', pointerEvents: 'none' }}>🏫</div>
        <div className="flex items-start justify-between gap-4">
          <BackButton href="/classes" className="mb-4" />
          <button
            onClick={() => setShowCreate(true)}
            className="shrink-0 px-4 py-2 rounded-full text-sm font-black transition-opacity hover:opacity-90 active:opacity-70"
            style={{ background: 'rgba(255,255,255,0.22)', color: '#fff', boxShadow: '0 3px 0 rgba(0,0,0,0.2), 0 6px 14px rgba(0,0,0,0.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.3)' }}
          >
            + Create
          </button>
        </div>
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
            style={{ background: 'rgba(255,255,255,0.18)', boxShadow: '0 4px 0 rgba(0,0,0,0.15)' }}
          >🏫</div>
          <div>
            <p className="text-xs font-black text-white/50 uppercase tracking-widest mb-0.5">My Classes</p>
            <h1 className="text-2xl font-black text-white leading-tight" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.25)' }}>
              {myClasses.length > 0 ? `${myClasses.length} Class${myClasses.length !== 1 ? 'es' : ''}` : 'My Classes'}
            </h1>
          </div>
        </div>
        <p className="text-sm text-white/65 mt-2 ml-0.5">Classes you created as a teacher.</p>
      </div>

      <div className="p-4 max-w-5xl mx-auto w-full">
        {loading ? (
          <SectionLoader />
        ) : myClasses.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-[var(--border)] p-12 text-center space-y-3 opacity-60">
            <p className="text-5xl">🏫</p>
            <p className="text-base font-bold text-[var(--text)]">No classes yet</p>
            <p className="text-sm text-[var(--text-muted)]">Tap + Create to make your first class</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {myClasses.map(cls => {
              const { gradient, glow } = classGradientColors(cls.id);
              return (
                <div key={cls.id} className={`rounded-2xl overflow-hidden bg-gradient-to-br ${gradient} flex flex-col transition-all hover:-translate-y-1 duration-200`}
                  style={{ boxShadow: `0 6px 0 ${glow}cc, 0 16px 40px ${glow}55`, position: 'relative' }}>
                  <div className="p-4 flex-1 cursor-pointer" onClick={() => router.push(`/classes/${cls.id}/home`)}>
                    {renamingId === cls.id ? (
                      <div className="flex items-center gap-2 mb-3">
                        <input autoFocus value={renameText}
                          onChange={e => setRenameText(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveRename(cls.id); if (e.key === 'Escape') setRenamingId(null); }}
                          onClick={e => e.stopPropagation()}
                          className="flex-1 px-2 py-1 rounded-lg bg-black/20 text-white text-sm font-bold focus:outline-none" />
                        <button onClick={e => { e.stopPropagation(); saveRename(cls.id); }} disabled={renaming} className="text-white/80 font-bold text-xs">✓</button>
                        <button onClick={e => { e.stopPropagation(); setRenamingId(null); }} className="text-white/60 text-xs">✕</button>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-lg font-black text-white leading-snug">{cls.name}</p>
                        <button onClick={e => { e.stopPropagation(); setRenamingId(cls.id); setRenameText(cls.name); }} className="text-white/40 hover:text-white/80 text-sm transition-colors shrink-0 mt-0.5">✏️</button>
                      </div>
                    )}
                    <p className="text-sm text-white/60 mb-4">👥 {cls.member_count ?? 0} student{(cls.member_count ?? 0) !== 1 ? 's' : ''}</p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-black text-white bg-black/25 px-2.5 py-1 rounded-xl tracking-wider flex-1 text-center">{cls.join_code}</code>
                      <button onClick={e => { e.stopPropagation(); copyCode(cls.join_code, cls.id); }} className="text-base transition-transform hover:scale-110 shrink-0">{copiedId === cls.id ? '✅' : '📋'}</button>
                      <button onClick={e => { e.stopPropagation(); copyLink(cls.join_code, cls.id); }} className="text-base transition-transform hover:scale-110 shrink-0">{copiedLinkId === cls.id ? '✅' : '🔗'}</button>
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
        )}
      </div>

      {/* Delete Confirm */}
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
              <button onClick={() => deleteClass(deleteConfirmId)} className="flex-1 py-3 rounded-2xl font-bold text-sm text-white bg-red-500 hover:bg-red-600 active:scale-95 transition-all">
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
}
