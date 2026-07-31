'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/useTranslation';
import { getImportedFolders, getImportedCollections } from '@/lib/storage';
import { pushLists, pullAll } from '@/lib/sync';
import type { ImportedFolder, ImportedCollection } from '@/lib/types';

const COLORS = [
  '#5B8AF0', '#FF6B6B', '#06D6A0', '#FFD166',
  '#A78BFA', '#FF9F43', '#F72585', '#4ECDC4',
  '#3D8BFF', '#FF5E57', '#00C9A7', '#FFC75F',
];

function cardColor(index: number) {
  return COLORS[index % COLORS.length];
}

export default function MyWordsPage() {
  const router = useRouter();
  const t = useTranslation();
  const [folders, setFolders] = useState<ImportedFolder[]>([]);
  const [orphaned, setOrphaned] = useState<ImportedCollection[]>([]);
  const [creating, setCreating] = useState(false);
  const [folderName, setFolderName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFolders(getImportedFolders());
    setOrphaned(getImportedCollections());
    pullAll().then(() => {
      setFolders(getImportedFolders());
      setOrphaned(getImportedCollections());
      pushLists();
    });
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

  const isEmpty = folders.length === 0 && orphaned.length === 0;

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

      <div className="p-4">
        {isEmpty ? (
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
          <>
            <div className="grid grid-cols-3 gap-3">
              {folders.map((folder, i) => (
                <Link
                  key={folder.name}
                  href={`/my-words/${encodeURIComponent(folder.name)}`}
                  className="flex flex-col rounded-2xl p-3 min-h-[100px] justify-between active:scale-95 transition-transform"
                  style={{ background: cardColor(i) }}
                >
                  <span className="text-2xl">📁</span>
                  <div>
                    <p className="font-bold text-white text-sm leading-tight line-clamp-2">{folder.name}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.75)' }}>
                      {folder.wordCount} words
                    </p>
                  </div>
                </Link>
              ))}
            </div>

            {orphaned.length > 0 && (
              <div className="mt-5">
                <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide px-1 mb-3">Unfiled</p>
                <div className="grid grid-cols-3 gap-3">
                  {orphaned.map((col, i) => (
                    <Link
                      key={col.name}
                      href={`/import?collection=${encodeURIComponent(col.name)}`}
                      className="flex flex-col rounded-2xl p-3 min-h-[100px] justify-between active:scale-95 transition-transform"
                      style={{ background: cardColor(folders.length + i) }}
                    >
                      <span className="text-2xl">📖</span>
                      <div>
                        <p className="font-bold text-white text-sm leading-tight line-clamp-2">{col.name}</p>
                        <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.75)' }}>
                          {col.count} words
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
