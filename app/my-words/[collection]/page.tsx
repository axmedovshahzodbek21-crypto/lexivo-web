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
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    setCollections(getCollectionsByFolder(folder));
    pullAll().then(() => {
      setCollections(getCollectionsByFolder(folder));
    });
  }, [folder]);

  const completedUnits = collections.filter(c => !!getMyUnitProgress(folder, c.name).completedAt).length;

  function handleDeleteFolder() {
    if (!confirm(t.extra.deleteEntireFolderConfirm(folder))) return;
    deleteImportedFolder(folder);
    pushLists();
    router.push('/my-words');
  }

  // Same "New unit" modal as Library (app/library/[folderId]). My Words units
  // only exist once they hold words, so instead of saving an empty unit this
  // opens it straight away on its Words / Add words tabs.
  function createUnit() {
    const name = newName.trim();
    if (!name) return;
    setShowCreate(false);
    router.push(`/my-words/${encodeURIComponent(folder)}/${encodeURIComponent(name)}`);
  }

  return (
    <div className="flex flex-col min-h-screen animate-fade-in pb-24">
      <div className="flex items-center gap-3 p-4 border-b border-[var(--border)]">
        <button onClick={() => router.back()} className="btn-icon text-lg" aria-label={t.extra.goBack}>←</button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-[var(--text)] truncate">{folder}</h1>
          <p className="text-xs text-[var(--text-muted)]">
            {t.extra.unitCount(collections.length)}
            {collections.length > 0 && <> · {t.collections.completed(completedUnits, collections.length)}</>}
          </p>
        </div>
        <button onClick={() => { setNewName(''); setShowCreate(true); }}
          className="w-9 h-9 rounded-full bg-[var(--primary-bg)] flex items-center justify-center text-lg font-bold text-[var(--primary)]"
          aria-label={t.extra.addWordsToFolderAria}
        >+</button>
        <button
          onClick={handleDeleteFolder}
          className="btn-icon text-base text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
          aria-label={t.extra.deleteFolderAria}
        >🗑️</button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-bold text-[var(--text)] mb-4">{t.libraryPage.newUnit}</h2>
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createUnit(); if (e.key === 'Escape') setShowCreate(false); }}
              placeholder={t.libraryPage.unitNamePlaceholder}
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--surface-2)] text-[var(--text)] text-sm border border-[var(--border)] outline-none focus:border-[var(--primary)] mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--surface-2)]">{t.libraryPage.cancel}</button>
              <button onClick={createUnit} disabled={!newName.trim()} className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-[var(--primary)] disabled:opacity-50">
                {t.libraryPage.create}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="p-4">
        {collections.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="text-6xl">📂</div>
            <p className="text-[var(--text-muted)] text-sm">{t.extra.noUnitsTapPlus}</p>
            <button onClick={() => { setNewName(''); setShowCreate(true); }}
              className="btn-primary px-6 py-3 text-sm font-semibold"
            >
              {t.libraryPage.newUnit}
            </button>
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

            <button onClick={() => { setNewName(''); setShowCreate(true); }}
              className="mt-5 flex items-center justify-center gap-2 w-full py-3 rounded-2xl border-2 border-dashed border-[var(--border)] text-sm font-medium text-[var(--text-muted)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
            >
              <span>+</span>
              <span>{t.extra.newUnit}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
