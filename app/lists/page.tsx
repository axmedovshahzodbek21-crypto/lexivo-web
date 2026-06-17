'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getCustomLists, saveCustomList, deleteCustomList } from '@/lib/storage';
import type { CustomList } from '@/lib/types';

function newList(name: string): CustomList {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: name.trim(),
    createdAt: new Date().toISOString(),
    words: [],
  };
}

export default function ListsPage() {
  const router = useRouter();
  const [lists, setLists] = useState<CustomList[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const reload = () => setLists(getCustomLists());
  useEffect(() => {
    reload();
    window.addEventListener('lexivo-sync', reload);
    return () => window.removeEventListener('lexivo-sync', reload);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    const list = newList(name);
    saveCustomList(list);
    setNewName('');
    setCreating(false);
    reload();
    router.push(`/lists/${list.id}`);
  };

  const handleDelete = (id: string) => {
    deleteCustomList(id);
    setDeleteId(null);
    reload();
  };

  return (
    <div className="flex flex-col min-h-screen animate-fade-in">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border)]">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-3 hover:text-[var(--text)] transition-colors"
        >
          ← Back
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[var(--text)]">📋 My Lists</h1>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">Custom word collections for focused study</p>
          </div>
          <button
            onClick={() => { setCreating(true); setNewName(''); }}
            className="btn-primary text-sm px-4 py-2"
          >
            + New List
          </button>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-3">
        {/* Create form */}
        {creating && (
          <div className="card space-y-3 animate-fade-in border-[var(--primary)]">
            <p className="text-sm font-semibold text-[var(--text)]">New list name</p>
            <input
              autoFocus
              type="text"
              placeholder="e.g. IELTS Vocab, My Hard Words…"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false); }}
              className="w-full px-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] text-sm focus:outline-none focus:border-[var(--primary)]"
            />
            <div className="flex gap-2">
              <button onClick={handleCreate} disabled={!newName.trim()} className="btn-primary flex-1 text-sm py-2">
                Create & open
              </button>
              <button onClick={() => setCreating(false)} className="btn-secondary flex-1 text-sm py-2">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Lists */}
        {lists.length === 0 && !creating ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📋</div>
            <h2 className="text-xl font-bold text-[var(--text)] mb-2">No lists yet</h2>
            <p className="text-sm text-[var(--text-muted)] mb-6 max-w-xs mx-auto leading-relaxed">
              Create a list to group words from any collection and study them together.
            </p>
            <button onClick={() => setCreating(true)} className="btn-primary">
              + Create your first list
            </button>
          </div>
        ) : (
          lists.map(list => (
            <ListRow
              key={list.id}
              list={list}
              confirmDelete={deleteId === list.id}
              onOpen={() => router.push(`/lists/${list.id}`)}
              onDeleteRequest={() => setDeleteId(list.id)}
              onDeleteConfirm={() => handleDelete(list.id)}
              onDeleteCancel={() => setDeleteId(null)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ListRow({
  list, confirmDelete, onOpen, onDeleteRequest, onDeleteConfirm, onDeleteCancel,
}: {
  list: CustomList;
  confirmDelete: boolean;
  onOpen: () => void;
  onDeleteRequest: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
}) {
  const created = new Date(list.createdAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  if (confirmDelete) {
    return (
      <div className="card border-[var(--danger)] space-y-3 animate-fade-in">
        <p className="text-sm font-semibold text-[var(--text)]">
          Delete "<span className="text-[var(--danger)]">{list.name}</span>"?
        </p>
        <p className="text-xs text-[var(--text-muted)]">
          This removes the list and its {list.words.length} word{list.words.length !== 1 ? 's' : ''}. The words themselves are not affected.
        </p>
        <div className="flex gap-2">
          <button onClick={onDeleteConfirm} className="flex-1 py-2 rounded-xl bg-red-50 border border-[var(--danger)] text-[var(--danger)] text-sm font-semibold hover:bg-red-100 transition-colors">
            Yes, delete
          </button>
          <button onClick={onDeleteCancel} className="flex-1 btn-secondary text-sm py-2">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card flex items-center gap-3 hover:border-[var(--primary)] transition-colors cursor-pointer" onClick={onOpen}>
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
        style={{ background: 'var(--primary-bg)' }}
      >
        📋
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[var(--text)] truncate">{list.name}</p>
        <p className="text-xs text-[var(--text-muted)]">
          {list.words.length} word{list.words.length !== 1 ? 's' : ''} · {created}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={e => { e.stopPropagation(); onDeleteRequest(); }}
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm text-[var(--text-muted)] hover:bg-red-50 hover:text-[var(--danger)] transition-colors"
          title="Delete list"
        >
          🗑
        </button>
        <span className="text-[var(--primary)]">→</span>
      </div>
    </div>
  );
}
