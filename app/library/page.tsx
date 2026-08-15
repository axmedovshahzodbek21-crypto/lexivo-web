'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

interface Folder {
  id: string;
  name: string;
  unit_count: number;
}

const CARD_COLORS = [
  '#5B8AF0','#FF6B6B','#06D6A0','#FFD166',
  '#A78BFA','#FF9F43','#F72585','#4ECDC4',
  '#3D8BFF','#FF5E57','#00C9A7','#FFC75F',
];

const darken = (hex: string, amt = 0.45) => {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgb(${Math.round(r*(1-amt))},${Math.round(g*(1-amt))},${Math.round(b*(1-amt))})`;
};
const lighten = (hex: string, amt = 0.3) => {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgb(${Math.round(r+(255-r)*amt)},${Math.round(g+(255-g)*amt)},${Math.round(b+(255-b)*amt)})`;
};

// Module-level cache — survives navigation within the same tab session
const _cache: Record<string, Folder[]> = {};

const EXAMPLE_SEEDED_KEY = 'lexivo_library_example_seeded';

// One-time real example (folder → unit → word) so a first-time teacher sees
// the actual structure, not an empty page. Guarded by a local flag so it
// never reappears even if they delete it — this is a courtesy seed, not a
// permanent fixture.
async function seedExampleFolder(teacherId: string): Promise<boolean> {
  try {
    const { data: folder } = await supabase
      .from('teacher_folders').insert({ teacher_id: teacherId, name: 'Vocabulary 101' }).select('id').single();
    if (!folder) return false;
    const { data: unit } = await supabase
      .from('teacher_units').insert({ folder_id: folder.id, teacher_id: teacherId, name: 'Unit 1' }).select('id').single();
    if (!unit) return false;
    await supabase.from('teacher_unit_words').insert({
      unit_id: unit.id,
      teacher_id: teacherId,
      word: 'apple',
      translation: 'olma',
      definition: 'a round fruit with red, yellow, or green skin and a whitish inside',
      part_of_speech: 'noun',
      pronunciation: '/ˈæp.əl/',
      definition_uz: "qizil, sariq yoki yashil po'stli, ichi oq mevali dumaloq meva",
      examples: [{ sentence: 'She ate a fresh apple for breakfast.', translation: 'U nonushta uchun yangi olma yedi.' }],
    });
    return true;
  } catch {
    return false;
  }
}

export default function LibraryPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const cached = user ? (_cache[user.id] ?? null) : null;
  const [folders, setFolders] = useState<Folder[]>(cached ?? []);
  const [loading, setLoading] = useState(cached === null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login'); return; }
    load();
  }, [user, authLoading]);

  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from('teacher_folders')
      .select('id, name, teacher_units(count)')
      .eq('teacher_id', user.id)
      .order('position')
      .order('created_at');
    const result = (data ?? []).map((f: any) => ({
      id: f.id,
      name: f.name,
      unit_count: f.teacher_units?.[0]?.count ?? 0,
    }));
    if (result.length === 0 && !localStorage.getItem(EXAMPLE_SEEDED_KEY)) {
      localStorage.setItem(EXAMPLE_SEEDED_KEY, '1');
      if (await seedExampleFolder(user.id)) { await load(); return; }
    }
    _cache[user.id] = result;
    setFolders(result);
    setLoading(false);
  }

  async function createFolder() {
    if (!newName.trim() || !user) return;
    setCreating(true);
    await supabase.from('teacher_folders').insert({ teacher_id: user.id, name: newName.trim() });
    setNewName(''); setShowCreate(false); setCreating(false);
    load();
  }

  async function renameFolder() {
    if (!renameId || !renameName.trim()) return;
    await supabase.from('teacher_folders').update({ name: renameName.trim() }).eq('id', renameId);
    setRenameId(null); setRenameName('');
    load();
  }

  async function deleteFolder(id: string, name: string) {
    if (!confirm(`Delete "${name}" and all its units and words?`)) return;
    await supabase.from('teacher_folders').delete().eq('id', id);
    load();
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[var(--text)]">📚 My Library</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">{folders.length} {folders.length === 1 ? 'folder' : 'folders'}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
          style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-light))' }}
        >
          + New Folder
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-bold text-[var(--text)] mb-4">New Folder</h2>
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createFolder(); if (e.key === 'Escape') setShowCreate(false); }}
              placeholder="Folder name"
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--surface-2)] text-[var(--text)] text-sm border border-[var(--border)] outline-none focus:border-[var(--primary)] mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--surface-2)]">Cancel</button>
              <button onClick={createFolder} disabled={creating || !newName.trim()} className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-[var(--primary)] disabled:opacity-50">
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename modal */}
      {renameId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-bold text-[var(--text)] mb-4">Rename Folder</h2>
            <input
              autoFocus
              value={renameName}
              onChange={e => setRenameName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') renameFolder(); if (e.key === 'Escape') setRenameId(null); }}
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--surface-2)] text-[var(--text)] text-sm border border-[var(--border)] outline-none focus:border-[var(--primary)] mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setRenameId(null)} className="px-4 py-2 rounded-xl text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--surface-2)]">Cancel</button>
              <button onClick={renameFolder} disabled={!renameName.trim()} className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-[var(--primary)] disabled:opacity-50">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {folders.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📚</div>
          <h2 className="text-xl font-bold text-[var(--text)] mb-2">No folders yet</h2>
          <p className="text-sm text-[var(--text-muted)] mb-8">Create a folder to organise your teaching units.</p>

          {/* Illustrative example — not real data, just shows the Folder → Unit → Words shape */}
          <div className="max-w-sm mx-auto mb-8">
            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">How it works</p>
            <div className="flex items-center justify-center gap-2 flex-wrap opacity-70 pointer-events-none select-none">
              <div
                className="rounded-xl px-3 py-2 text-left"
                style={{ background: `linear-gradient(135deg, ${lighten(CARD_COLORS[0])}, ${CARD_COLORS[0]}, ${darken(CARD_COLORS[0])})`, border: `1.5px dashed ${darken(CARD_COLORS[0])}` }}
              >
                <p className="text-[9px] font-bold text-white/70 uppercase tracking-wide">Folder</p>
                <p className="text-xs font-bold text-white">📁 Vocabulary 101</p>
              </div>
              <span className="text-[var(--text-muted)]">→</span>
              <div
                className="rounded-xl px-3 py-2 text-left"
                style={{ background: `linear-gradient(135deg, ${lighten(CARD_COLORS[1])}, ${CARD_COLORS[1]}, ${darken(CARD_COLORS[1])})`, border: `1.5px dashed ${darken(CARD_COLORS[1])}` }}
              >
                <p className="text-[9px] font-bold text-white/70 uppercase tracking-wide">Unit</p>
                <p className="text-xs font-bold text-white">📖 Unit 1</p>
              </div>
              <span className="text-[var(--text-muted)]">→</span>
              <div className="rounded-xl px-3 py-2 text-left border border-[var(--border)]" style={{ background: 'var(--surface-2)' }}>
                <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wide">Words</p>
                <p className="text-xs font-bold text-[var(--text)]">apple · book · water</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowCreate(true)}
            className="px-6 py-3 rounded-xl text-sm font-bold text-white"
            style={{ background: 'var(--primary)' }}
          >New Folder</button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {folders.map((folder, i) => {
            const color = CARD_COLORS[i % CARD_COLORS.length];
            return (
              <div key={folder.id} className="relative group">
                <Link href={`/library/${folder.id}`}>
                  <div
                    className="rounded-2xl cursor-pointer animate-heartbeat hover:-translate-y-1 transition-all duration-200 relative overflow-hidden"
                    style={{ background: `linear-gradient(135deg, ${lighten(color)}, ${color})`, boxShadow: `0 12px 0 ${darken(color)}, 0 16px 32px ${color}99`, minHeight: '120px' }}
                  >
                    <div className="p-4 text-2xl">📁</div>
                    <div className="absolute bottom-0 left-0 right-0 px-4 py-3" style={{ background: 'rgba(0,0,0,0.18)', backdropFilter: 'blur(8px)' }}>
                      <p className="text-white font-bold text-sm leading-tight line-clamp-2" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>{folder.name}</p>
                      <p className="text-white/70 text-xs mt-0.5">{folder.unit_count} {folder.unit_count === 1 ? 'unit' : 'units'}</p>
                    </div>
                  </div>
                </Link>
                {/* Action dots */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <button
                    onClick={e => { e.preventDefault(); setRenameId(folder.id); setRenameName(folder.name); }}
                    className="w-6 h-6 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white text-xs backdrop-blur"
                    title="Rename"
                  >✏️</button>
                  <button
                    onClick={e => { e.preventDefault(); deleteFolder(folder.id, folder.name); }}
                    className="w-6 h-6 rounded-full bg-white/20 hover:bg-red-500/80 flex items-center justify-center text-white text-xs backdrop-blur"
                    title="Delete"
                  >🗑</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
