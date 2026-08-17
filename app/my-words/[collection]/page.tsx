'use client';
import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/useTranslation';
import { deleteImportedFolder, getCollectionsByFolder, getMyUnitProgress } from '@/lib/storage';
import { pushLists, pullAll } from '@/lib/sync';
import type { ImportedCollection } from '@/lib/types';

const COLORS = [
  '#5B8AF0', '#FF6B6B', '#06D6A0', '#FFD166',
  '#A78BFA', '#FF9F43', '#F72585', '#4ECDC4',
  '#3D8BFF', '#FF5E57', '#00C9A7', '#FFC75F',
];

function cardColor(index: number) {
  return COLORS[index % COLORS.length];
}

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
    setCollections(getCollectionsByFolder(folder));
    pullAll().then(() => {
      setCollections(getCollectionsByFolder(folder));
    });
  }, [folder]);

  const completedUnits = collections.filter(c => !!getMyUnitProgress(folder, c.name).completedAt).length;

  function handleDeleteFolder() {
    if (!confirm(`Delete the entire "${folder}" folder and all its words?`)) return;
    deleteImportedFolder(folder);
    pushLists();
    router.push('/my-words');
  }

  return (
    <div className="flex flex-col min-h-screen animate-fade-in pb-24">
      <div className="flex items-center gap-3 p-4 border-b border-[var(--border)]">
        <button onClick={() => router.back()} className="btn-icon text-lg" aria-label="Go back">←</button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-[var(--text)] truncate">{folder}</h1>
          <p className="text-xs text-[var(--text-muted)]">
            {collections.length} unit{collections.length !== 1 ? 's' : ''}
            {collections.length > 0 && <> · {t.collections.completed(completedUnits, collections.length)}</>}
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

      <div className="p-4">
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
          <>
            <div className="grid grid-cols-3 gap-3">
              {collections.map((col, i) => (
                <Link
                  key={col.name}
                  href={`/my-words/${encodeURIComponent(folder)}/${encodeURIComponent(col.name)}`}
                  className="relative flex flex-col rounded-2xl p-3 min-h-[100px] justify-between active:scale-95 transition-transform"
                  style={{ background: cardColor(i) }}
                >
                  {getMyUnitProgress(folder, col.name).completedAt && (
                    <span className="absolute top-2 right-2 text-sm" title={t.myWords.completedBadge}>✅</span>
                  )}
                  <span className="text-2xl">📖</span>
                  <div>
                    <p className="font-bold text-white text-sm leading-tight line-clamp-2">{col.name}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.75)' }}>
                      {t.myWords.wordCount(col.count)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>

            <Link
              href={`/import?folder=${encodeURIComponent(folder)}`}
              className="mt-5 flex items-center justify-center gap-2 w-full py-3 rounded-2xl border-2 border-dashed border-[var(--border)] text-sm font-medium text-[var(--text-muted)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
            >
              <span>+</span>
              <span>New Unit</span>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
