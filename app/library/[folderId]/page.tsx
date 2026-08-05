'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

interface Unit {
  id: string;
  name: string;
  word_count: number;
}

const CARD_COLORS = [
  '#5B8AF0','#FF6B6B','#06D6A0','#FFD166',
  '#A78BFA','#FF9F43','#F72585','#4ECDC4',
  '#3D8BFF','#FF5E57','#00C9A7','#FFC75F',
];

// Module-level cache keyed by folderId
const _cache: Record<string, { name: string; units: Unit[] }> = {};

export default function FolderPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const folderId = params.folderId as string;

  const cached = _cache[folderId] ?? null;
  const [folderName, setFolderName] = useState(cached?.name ?? '');
  const [units, setUnits] = useState<Unit[]>(cached?.units ?? []);
  const [loading, setLoading] = useState(cached === null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState('');

  useEffect(() => {
    if (!user) { router.replace('/login'); return; }
    load();
  }, [user, folderId]);

  async function load() {
    if (!user) return;
    const [folderRes, unitsRes] = await Promise.all([
      supabase.from('teacher_folders').select('name').eq('id', folderId).single(),
      supabase.from('teacher_units').select('id, name, teacher_unit_words(count)').eq('folder_id', folderId).order('position').order('created_at'),
    ]);
    const name = folderRes.data?.name ?? '';
    const result = (unitsRes.data ?? []).map((u: any) => ({
      id: u.id,
      name: u.name,
      word_count: u.teacher_unit_words?.[0]?.count ?? 0,
    }));
    _cache[folderId] = { name, units: result };
    setFolderName(name);
    setUnits(result);
    setLoading(false);
  }

  async function createUnit() {
    if (!newName.trim() || !user) return;
    setCreating(true);
    await supabase.from('teacher_units').insert({ folder_id: folderId, teacher_id: user.id, name: newName.trim() });
    setNewName(''); setShowCreate(false); setCreating(false);
    load();
  }

  async function renameUnit() {
    if (!renameId || !renameName.trim()) return;
    await supabase.from('teacher_units').update({ name: renameName.trim() }).eq('id', renameId);
    setRenameId(null); setRenameName('');
    load();
  }

  async function deleteUnit(id: string, name: string) {
    if (!confirm(`Delete "${name}" and all its words?`)) return;
    await supabase.from('teacher_units').delete().eq('id', id);
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
      <div className="flex items-center gap-3 mb-1">
        <button onClick={() => router.push('/library')} className="text-[var(--text-muted)] hover:text-[var(--primary)] text-sm font-medium">← Library</button>
      </div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[var(--text)]">{folderName}</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">{units.length} {units.length === 1 ? 'unit' : 'units'}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
          style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-light))' }}
        >+ New Unit</button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-bold text-[var(--text)] mb-4">New Unit</h2>
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createUnit(); if (e.key === 'Escape') setShowCreate(false); }}
              placeholder="Unit name"
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--surface-2)] text-[var(--text)] text-sm border border-[var(--border)] outline-none focus:border-[var(--primary)] mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--surface-2)]">Cancel</button>
              <button onClick={createUnit} disabled={creating || !newName.trim()} className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-[var(--primary)] disabled:opacity-50">
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
            <h2 className="text-lg font-bold text-[var(--text)] mb-4">Rename Unit</h2>
            <input
              autoFocus
              value={renameName}
              onChange={e => setRenameName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') renameUnit(); if (e.key === 'Escape') setRenameId(null); }}
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--surface-2)] text-[var(--text)] text-sm border border-[var(--border)] outline-none focus:border-[var(--primary)] mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setRenameId(null)} className="px-4 py-2 rounded-xl text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--surface-2)]">Cancel</button>
              <button onClick={renameUnit} disabled={!renameName.trim()} className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-[var(--primary)] disabled:opacity-50">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {units.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">📖</div>
          <h2 className="text-xl font-bold text-[var(--text)] mb-2">No units yet</h2>
          <p className="text-sm text-[var(--text-muted)] mb-6">Add a unit to start building your vocabulary library.</p>
          <button onClick={() => setShowCreate(true)} className="px-6 py-3 rounded-xl text-sm font-bold text-white" style={{ background: 'var(--primary)' }}>New Unit</button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {units.map((unit, i) => {
            const color = CARD_COLORS[i % CARD_COLORS.length];
            return (
              <div key={unit.id} className="relative group">
                <Link href={`/library/${folderId}/${unit.id}`}>
                  <div
                    className="rounded-2xl p-4 cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]"
                    style={{ background: color, boxShadow: `0 6px 24px ${color}55` }}
                  >
                    <div className="text-2xl mb-6">📖</div>
                    <p className="text-white font-bold text-sm leading-tight line-clamp-2">{unit.name}</p>
                    <p className="text-white/70 text-xs mt-1">{unit.word_count} {unit.word_count === 1 ? 'word' : 'words'}</p>
                  </div>
                </Link>
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <button
                    onClick={e => { e.preventDefault(); setRenameId(unit.id); setRenameName(unit.name); }}
                    className="w-6 h-6 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white text-xs backdrop-blur"
                    title="Rename"
                  >✏️</button>
                  <button
                    onClick={e => { e.preventDefault(); deleteUnit(unit.id, unit.name); }}
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
