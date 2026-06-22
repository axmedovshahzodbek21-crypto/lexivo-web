'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/useTranslation';
import { getImportedCollections, getImportedFolders } from '@/lib/storage';
import type { ImportedCollection, ImportedFolder } from '@/lib/types';

export default function MyWordsPage() {
  const router = useRouter();
  const t = useTranslation();
  const [collections, setCollections] = useState<ImportedCollection[]>([]);
  const [folders, setFolders] = useState<ImportedFolder[]>([]);

  useEffect(() => {
    const load = () => {
      setCollections(getImportedCollections());
      setFolders(getImportedFolders());
    };
    load();
    window.addEventListener('lexivo-sync', load);
    return () => window.removeEventListener('lexivo-sync', load);
  }, []);

  const isEmpty = folders.length === 0 && collections.length === 0;

  return (
    <div className="flex flex-col min-h-screen animate-fade-in pb-24">
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
        <button onClick={() => router.back()} className="btn-icon text-lg" aria-label="Go back">←</button>
        <h1 className="font-bold text-[var(--text)]">{t.myWords.title}</h1>
        <Link
          href="/import"
          className="w-9 h-9 rounded-full bg-[var(--primary-bg)] flex items-center justify-center text-lg font-bold text-[var(--primary)]"
          aria-label={t.myWords.addWords}
        >+</Link>
      </div>

      <div className="p-4 space-y-4">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="text-6xl">📚</div>
            <p className="text-[var(--text-muted)] text-sm">{t.myWords.empty}</p>
            <Link href="/import" className="btn-primary px-6 py-3 text-sm font-semibold">
              {t.myWords.addWords}
            </Link>
          </div>
        ) : (
          <>
            {/* Folders */}
            {folders.length > 0 && (
              <section className="space-y-2">
                {collections.length > 0 && (
                  <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide px-1">Folders</p>
                )}
                {folders.map(folder => (
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
                ))}
              </section>
            )}

            {/* Root-level collections */}
            {collections.length > 0 && (
              <section className="space-y-2">
                {folders.length > 0 && (
                  <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide px-1">Collections</p>
                )}
                {collections.map(col => (
                  <Link
                    key={col.name}
                    href={`/my-words/${encodeURIComponent(col.name)}`}
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
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
