'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/useTranslation';
import { getImportedFolders } from '@/lib/storage';
import type { ImportedFolder } from '@/lib/types';

export default function MyWordsPage() {
  const router = useRouter();
  const t = useTranslation();
  const [folders, setFolders] = useState<ImportedFolder[]>([]);
  const [creating, setCreating] = useState(false);
  const [folderName, setFolderName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = () => setFolders(getImportedFolders());
    load();
    window.addEventListener('lexivo-sync', load);
    return () => window.removeEventListener('lexivo-sync', load);
  }, []);

  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  function handleCreateFolder(e: React.FormEvent) {
    e.preventDefault();
    const name = folderName.trim();
    if (!name) return;
    setFolderName('');
    setCreating(false);
    router.push(`/my-words/${encodeURIComponent(name)}`);
  }

  return (
    <div className="flex flex-col min-h-screen animate-fade-in pb-24">
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
        <button onClick={() => router.back()} className="btn-icon text-lg" aria-label="Go back">←</button>
        <h1 className="font-bold text-[var(--text)]">{t.myWords.title}</h1>
        <button
          onClick={() => setCreating(true)}
          className="w-9 h-9 rounded-full bg-[var(--primary-bg)] flex items-center justify-center text-lg font-bold text-[var(--primary)]"
          aria-label="Create folder"
        >+</button>
      </div>

      {creating && (
        <form onSubmit={handleCreateFolder} className="p-4 border-b border-[var(--border)] flex gap-2">
          <input
            ref={inputRef}
            value={folderName}
            onChange={e => setFolderName(e.target.value)}
            placeholder="Folder name..."
            className="flex-1 px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-sm outline-none focus:border-[var(--primary)]"
          />
          <button type="submit" className="btn-primary px-4 py-2 text-sm font-semibold rounded-xl">Create</button>
          <button
            type="button"
            onClick={() => { setCreating(false); setFolderName(''); }}
            className="px-3 py-2 text-sm text-[var(--text-muted)]"
          >Cancel</button>
        </form>
      )}

      <div className="p-4 space-y-3">
        {folders.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="text-6xl">📁</div>
            <p className="text-[var(--text-muted)] text-sm">No folders yet. Create one to get started.</p>
            {!creating && (
              <button onClick={() => setCreating(true)} className="btn-primary px-6 py-3 text-sm font-semibold">
                Create Folder
              </button>
            )}
          </div>
        ) : (
          folders.map(folder => (
            <Link
              key={folder.name}
              href={`/my-words/${encodeURIComponent(folder.name)}`}
              className="card flex items-center gap-4 hover:border-[var(--primary)] transition-colors"
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: 'var(--primary-bg)' }}>
                📁
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[var(--text)] truncate">{folder.name}</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {folder.collectionCount} collection{folder.collectionCount !== 1 ? 's' : ''} · {folder.wordCount} item{folder.wordCount !== 1 ? 's' : ''}
                </p>
              </div>
              <span className="text-[var(--text-muted)] text-lg">›</span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
