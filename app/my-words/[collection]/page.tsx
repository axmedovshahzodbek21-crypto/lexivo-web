'use client';
import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/useTranslation';
import { deleteImportedFolder, getCollectionsByFolder } from '@/lib/storage';
import type { ImportedCollection } from '@/lib/types';

interface Props {
  params: Promise<{ collection: string }>;
}

export default function FolderPage({ params }: Props) {
  const { collection: encodedSlug } = use(params);
  const folder = decodeURIComponent(encodedSlug);
  const router = useRouter();
  const t = useTranslation();
  const [collections, setCollections] = useState<ImportedCollection[]>([]);

  useEffect(() => {
    const load = () => setCollections(getCollectionsByFolder(folder));
    load();
    window.addEventListener('lexivo-sync', load);
    return () => window.removeEventListener('lexivo-sync', load);
  }, [folder]);

  function handleDeleteFolder() {
    if (!confirm(`Delete the entire "${folder}" folder and all its words?`)) return;
    deleteImportedFolder(folder);
    router.push('/my-words');
  }

  return (
    <div className="flex flex-col min-h-screen animate-fade-in pb-24">
      <div className="flex items-center gap-3 p-4 border-b border-[var(--border)]">
        <button onClick={() => router.back()} className="btn-icon text-lg" aria-label="Go back">←</button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">📁</span>
            <h1 className="font-bold text-[var(--text)] truncate">{folder}</h1>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            {collections.length} unit{collections.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href={`/import?folder=${encodeURIComponent(folder)}`}
          className="w-9 h-9 rounded-full bg-[var(--primary-bg)] flex items-center justify-center text-lg font-bold text-[var(--primary)]"
          aria-label="Add words to folder"
        >+</Link>
        <button
          onClick={handleDeleteFolder}
          className="btn-icon text-base text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
          aria-label="Delete folder"
        >🗑️</button>
      </div>

      <div className="p-4 space-y-3">
        {collections.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="text-6xl">📂</div>
            <p className="text-[var(--text-muted)] text-sm">No units yet. Tap + to add words.</p>
            <Link
              href={`/import?folder=${encodeURIComponent(folder)}`}
              className="btn-primary px-6 py-3 text-sm font-semibold"
            >
              + Add Words
            </Link>
          </div>
        ) : (
          collections.map(col => (
            <Link
              key={col.name}
              href={`/my-words/${encodeURIComponent(folder)}/${encodeURIComponent(col.name)}`}
              className="card flex items-center gap-4 hover:border-[var(--primary)] transition-colors"
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: 'var(--primary-bg)' }}>
                📖
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[var(--text)] truncate">{col.name}</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{t.myWords.wordCount(col.count)}</p>
              </div>
              <span className="text-[var(--text-muted)] text-lg">›</span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
