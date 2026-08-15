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

const darken = (hex: string, amt = 0.45) => {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgb(${Math.round(r*(1-amt))},${Math.round(g*(1-amt))},${Math.round(b*(1-amt))})`;
};

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
          <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
            <div className="text-6xl">📁</div>
            <p className="text-[var(--text-muted)] text-sm">No folders yet. Create one to get started.</p>

            {/* Illustrative example — not real data, just shows the Folder → Collection → Words shape */}
            <div className="max-w-sm">
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">How it works</p>
              <div className="flex items-center justify-center gap-2 flex-wrap opacity-70 pointer-events-none select-none">
                <div className="rounded-xl px-3 py-2 text-left" style={{ background: cardColor(0), border: `1.5px dashed ${darken(cardColor(0))}` }}>
                  <p className="text-[9px] font-bold text-white/70 uppercase tracking-wide">Folder</p>
                  <p className="text-xs font-bold text-white">📁 Vocabulary 101</p>
                </div>
                <span className="text-[var(--text-muted)]">→</span>
                <div className="rounded-xl px-3 py-2 text-left" style={{ background: cardColor(1), border: `1.5px dashed ${darken(cardColor(1))}` }}>
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
                  className="flex flex-col rounded-2xl p-3 min-h-[100px] justify-between transition-all duration-200 hover:-translate-y-1 animate-heartbeat"
                  style={{
                    background: cardColor(i),
                    boxShadow: '0 6px 0 rgba(0,0,0,0.25), 0 10px 24px rgba(0,0,0,0.2)',
                  }}
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
                      className="flex flex-col rounded-2xl p-3 min-h-[100px] justify-between transition-all duration-200 hover:-translate-y-1 animate-heartbeat"
                      style={{
                        background: cardColor(folders.length + i),
                        boxShadow: '0 6px 0 rgba(0,0,0,0.25), 0 10px 24px rgba(0,0,0,0.2)',
                      }}
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
