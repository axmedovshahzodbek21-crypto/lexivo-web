'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/useTranslation';
import { getImportedCollections } from '@/lib/storage';
import type { ImportedCollection } from '@/lib/types';

export default function MyWordsPage() {
  const router = useRouter();
  const t = useTranslation();
  const [collections, setCollections] = useState<ImportedCollection[]>([]);

  useEffect(() => {
    const load = () => setCollections(getImportedCollections());
    load();
    window.addEventListener('lexivo-sync', load);
    return () => window.removeEventListener('lexivo-sync', load);
  }, []);

  return (
    <div className="flex flex-col min-h-screen animate-fade-in pb-24">
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
        <button onClick={() => router.back()} className="btn-icon text-lg">←</button>
        <h1 className="font-bold text-[var(--text)]">{t.myWords.title}</h1>
        <Link
          href="/import"
          className="w-9 h-9 rounded-full bg-[var(--primary-bg)] flex items-center justify-center text-lg font-bold text-[var(--primary)]"
          title={t.myWords.addWords}
        >+</Link>
      </div>

      <div className="p-4 space-y-3">
        {collections.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="text-6xl">📚</div>
            <p className="text-[var(--text-muted)] text-sm">{t.myWords.empty}</p>
            <Link href="/import" className="btn-primary px-6 py-3 text-sm font-semibold">
              {t.myWords.addWords}
            </Link>
          </div>
        ) : (
          collections.map(col => (
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
          ))
        )}
      </div>
    </div>
  );
}
