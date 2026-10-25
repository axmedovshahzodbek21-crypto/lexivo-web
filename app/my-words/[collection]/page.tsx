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

const darken = (hex: string, amt = 0.45) => {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgb(${Math.round(r*(1-amt))},${Math.round(g*(1-amt))},${Math.round(b*(1-amt))})`;
};
const lighten = (hex: string, amt = 0.3) => {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgb(${Math.round(r+(255-r)*amt)},${Math.round(g+(255-g)*amt)},${Math.round(b+(255-b)*amt)})`;
};

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
    <div className="max-w-2xl w-full mx-auto px-4 py-6 pb-24 animate-fade-in">
      {/* Header — same layout as the Library folder page */}
      <div className="flex items-center gap-3 mb-1">
        <button onClick={() => router.push('/my-words')} className="text-[var(--text-muted)] hover:text-[var(--primary)] text-sm font-medium">← {t.myWords.title}</button>
      </div>
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-[var(--text)] truncate">{folder}</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {t.libraryPage.unitsCount(collections.length)}
            {collections.length > 0 && <> · {t.libraryPage.wordsCount(collections.reduce((s, c) => s + c.count, 0))}</>}
            {completedUnits > 0 && <> · ✅ {completedUnits}/{collections.length}</>}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleDeleteFolder}
            className="w-9 h-9 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-base text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
            aria-label={t.extra.deleteFolderAria}
          >🗑️</button>
          <button
            onClick={() => { setNewName(''); setShowCreate(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-light))' }}
          >+ {t.libraryPage.newUnit}</button>
        </div>
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

      <div>
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
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {collections.map((col, i) => {
              const color = cardColor(i);
              return (
                // Same card as the Library's units (app/library/[folderId]).
                <Link key={col.name} href={`/my-words/${encodeURIComponent(folder)}/${encodeURIComponent(col.name)}`}>
                  <div
                    className="rounded-2xl cursor-pointer animate-heartbeat hover:-translate-y-1 transition-all duration-200 relative overflow-hidden"
                    style={{ background: `linear-gradient(135deg, ${lighten(color)}, ${color})`, boxShadow: `0 12px 0 ${darken(color)}, 0 16px 32px ${color}99`, minHeight: '120px' }}
                  >
                    {getMyUnitProgress(folder, col.name).completedAt && (
                      <span className="absolute top-3 right-3 text-sm" title={t.myWords.completedBadge}>✅</span>
                    )}
                    <div className="p-4 text-2xl">📖</div>
                    <div className="absolute bottom-0 left-0 right-0 px-4 py-3" style={{ background: 'rgba(0,0,0,0.18)', backdropFilter: 'blur(8px)' }}>
                      <p className="text-white font-bold text-sm leading-tight line-clamp-2" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>{col.name}</p>
                      <p className="text-white/70 text-xs mt-0.5">{t.libraryPage.wordsCount(col.count)}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
