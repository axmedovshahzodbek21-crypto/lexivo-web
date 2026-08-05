'use client';
import { SectionLoader } from '@/components/Loader';
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
      const { data: memberRows } = await supabase.from('class_members').select('class_id').in('class_id', taughtIds);
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
    const { error: err } = await supabase.from('classes').insert({
      name: className.trim(), join_code: generateCode(), teacher_id: user.id,
    });
    if (err) { setCreateError('Failed to create class.'); setCreating(false); return; }
    setClassName(''); setShowCreate(false); setCreating(false);
    _cache.delete(user.id); load();
  };

  const deleteClass = async (classId: string) => {
    if (!user) return;
    await supabase.from('classes').delete().eq('id', classId);
    setDeleteConfirmId(null);
    _cache.delete(user.id); load();
  };

  const saveRename = async (classId: string) => {
    if (!renameText.trim()) return;
    setRenaming(true);
    await supabase.from('classes').update({ name: renameText.trim() }).eq('id', classId);
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
      <div className="flex items-center gap-3 p-4 border-b border-[var(--border)]">
        <button onClick={() => router.back()} className="btn-icon text-lg" aria-label="Go back">←</button>
        <div className="flex-1">
          <h1 className="font-bold text-[var(--text)]">🏫 My Classes</h1>
          <p className="text-xs text-[var(--text-muted)]">Classes you created</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 rounded-xl font-bold text-sm text-white"
          style={{ background: 'var(--primary)' }}
        >
          + Create
        </button>
      </div>

      <div className="p-4 space-y-3 max-w-2xl mx-auto w-full">
        {loading ? (
          <SectionLoader />
        ) : myClasses.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-[var(--border)] p-12 text-center space-y-3 opacity-60">
            <p className="text-5xl">🏫</p>
            <p className="text-base font-bold text-[var(--text)]">No classes yet</p>
            <p className="text-sm text-[var(--text-muted)]">Tap + Create to make your first class</p>
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
                    <button onClick={e => { e.stopPropagation(); setRenamingId(cls.id); setRenameText(cls.name); }} className="text-white/40 hover:text-white/80 text-sm transition-colors">✏️</button>
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
