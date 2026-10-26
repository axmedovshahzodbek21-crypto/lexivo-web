'use client';
import PageTip from '@/components/PageTip';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/useTranslation';
import { getImportedFolders, getImportedCollections, addImportedWords, generateImportedWordId, getCollectionsByFolder, getMyUnitProgress, resetMyWordsProgress } from '@/lib/storage';
import { pushLists, pullAll } from '@/lib/sync';
import type { ImportedFolder, ImportedCollection } from '@/lib/types';
import BackButton from '@/components/BackButton';

const EXAMPLE_SEEDED_KEY = 'lexivo_mywords_example_seeded';

// One-time real example (folder → collection → word) so a first-time user
// sees the actual structure, not an empty page. Guarded by a local flag so
// it never reappears even if they delete it — this is a courtesy seed, not
// a permanent fixture. The flag is set only after the seed word is actually
// added, not before, so a failure partway through doesn't permanently lock
// out a retry (see the equivalent teacher-folder fix in teacher_library_
// screen.dart / app/library/page.tsx).
function seedExampleFolderIfNeeded(): boolean {
  if (typeof window === 'undefined') return false;
  if (localStorage.getItem(EXAMPLE_SEEDED_KEY)) return false;
  addImportedWords([{
    id: generateImportedWordId(),
    word: 'apple',
    translation: 'olma',
    definition: 'a round fruit with red, yellow, or green skin and a whitish inside',
    partOfSpeech: 'noun',
    pronunciation: '/ˈæp.əl/',
    definitionUz: "qizil, sariq yoki yashil po'stli, ichi oq mevali dumaloq meva",
    examples: [{ sentence: 'She ate a fresh apple for breakfast.', translation: 'U nonushta uchun yangi olma yedi.' }],
    language: 'en-US',
    addedAt: Date.now(),
  }], 'Unit 1', 'Vocabulary 101');
  localStorage.setItem(EXAMPLE_SEEDED_KEY, '1');
  return true;
}

const COLORS = [
  '#5B8AF0', '#FF6B6B', '#06D6A0', '#FFD166',
  '#A78BFA', '#FF9F43', '#F72585', '#4ECDC4',
  '#3D8BFF', '#FF5E57', '#00C9A7', '#FFC75F',
];

function cardColor(index: number) {
  return COLORS[index % COLORS.length];
}

function completedUnitsInFolder(folderName: string): number {
  return getCollectionsByFolder(folderName).filter(c => !!getMyUnitProgress(folderName, c.name).completedAt).length;
}

const darken = (hex: string, amt = 0.45) => {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgb(${Math.round(r*(1-amt))},${Math.round(g*(1-amt))},${Math.round(b*(1-amt))})`;
};
const lighten = (hex: string, amt = 0.3) => {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgb(${Math.round(r+(255-r)*amt)},${Math.round(g+(255-g)*amt)},${Math.round(b+(255-b)*amt)})`;
};

// Same card as the Library page's folders (app/library/page.tsx).
function FolderCard({ href, color, icon, name, subtitle }: { href: string; color: string; icon: string; name: string; subtitle: string }) {
  return (
    <Link href={href}>
      <div
        className="rounded-2xl cursor-pointer animate-heartbeat hover:-translate-y-1 transition-all duration-200 relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${lighten(color)}, ${color})`, boxShadow: `0 12px 0 ${darken(color)}, 0 16px 32px ${color}99`, minHeight: '120px' }}
      >
        <div className="p-4 text-2xl">{icon}</div>
        <div className="absolute bottom-0 left-0 right-0 px-4 py-3" style={{ background: 'rgba(0,0,0,0.18)', backdropFilter: 'blur(8px)' }}>
          <p className="text-white font-bold text-sm leading-tight line-clamp-2" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>{name}</p>
          <p className="text-white/70 text-xs mt-0.5">{subtitle}</p>
        </div>
      </div>
    </Link>
  );
}

export default function MyWordsPage() {
  const router = useRouter();
  const t = useTranslation();
  const [folders, setFolders] = useState<ImportedFolder[]>([]);
  const [orphaned, setOrphaned] = useState<ImportedCollection[]>([]);
  const [creating, setCreating] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [resetConfirm, setResetConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let initialFolders = getImportedFolders();
    let initialOrphaned = getImportedCollections();
    if (initialFolders.length === 0 && initialOrphaned.length === 0 && seedExampleFolderIfNeeded()) {
      initialFolders = getImportedFolders();
      initialOrphaned = getImportedCollections();
    }
    setFolders(initialFolders);
    setOrphaned(initialOrphaned);
    // Pull first so any locally-seeded example folder (or other pending
    // local state) merges with the cloud before pushing — pushing first
    // raced the pull that was about to supersede it anyway.
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

  function handleResetProgress() {
    resetMyWordsProgress();
    setResetConfirm(false);
    setFolders(getImportedFolders());
    setOrphaned(getImportedCollections());
    pushLists();
  }

  const isEmpty = folders.length === 0 && orphaned.length === 0;

  return (
    <div className="max-w-2xl w-full mx-auto px-4 py-6 pb-24 animate-fade-in">
      <BackButton />
      {/* Header — same layout as the Library page */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-[var(--text)]">{t.myWords.title} <PageTip id="my_words" inline /></h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">{t.libraryPage.folderCount(folders.length)}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!isEmpty && (
            <button
              onClick={() => setResetConfirm(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold border-[1.5px] transition-colors hover:bg-[rgba(245,158,11,0.12)]"
              style={{ borderColor: 'var(--warning)', color: 'var(--warning)' }}
              aria-label={t.extra.resetMyWordsAria}
              title={t.extra.resetMyWordsAria}
            >↺ <span className="hidden sm:inline">{t.extra.reset}</span></button>
          )}
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-light))' }}
          >
            + {t.libraryPage.newFolder}
          </button>
        </div>
      </div>

      {/* Create modal */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => { setCreating(false); setFolderName(''); }}>
          <form onSubmit={handleCreateFolder} className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-[var(--text)] mb-4">{t.libraryPage.newFolder}</h2>
            <input
              ref={inputRef}
              value={folderName}
              onChange={e => setFolderName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') { setCreating(false); setFolderName(''); } }}
              placeholder={t.extra.folderNamePlaceholder}
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--surface-2)] text-[var(--text)] text-sm border border-[var(--border)] outline-none focus:border-[var(--primary)] mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => { setCreating(false); setFolderName(''); }}
                className="px-4 py-2 rounded-xl text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
              >{t.extra.cancel}</button>
              <button type="submit" disabled={!folderName.trim()} className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-[var(--primary)] disabled:opacity-50">{t.extra.create}</button>
            </div>
          </form>
        </div>
      )}

      <div>
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
            <div className="text-6xl">📁</div>
            <p className="text-[var(--text-muted)] text-sm">{t.extra.noFoldersCreateOne}</p>

            {/* Illustrative example — not real data, just shows the Folder → Collection → Words shape */}
            <div className="max-w-sm">
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">{t.extra.howItWorks}</p>
              <div className="flex items-center justify-center gap-2 flex-wrap opacity-70 pointer-events-none select-none">
                <div className="rounded-xl px-3 py-2 text-left" style={{ background: cardColor(0), border: `1.5px dashed ${darken(cardColor(0))}` }}>
                  <p className="text-[9px] font-bold text-white/70 uppercase tracking-wide">{t.extra.folder}</p>
                  <p className="text-xs font-bold text-white">📁 Vocabulary 101</p>
                </div>
                <span className="text-[var(--text-muted)]">→</span>
                <div className="rounded-xl px-3 py-2 text-left" style={{ background: cardColor(1), border: `1.5px dashed ${darken(cardColor(1))}` }}>
                  <p className="text-[9px] font-bold text-white/70 uppercase tracking-wide">{t.extra.unit}</p>
                  <p className="text-xs font-bold text-white">📖 Unit 1</p>
                </div>
                <span className="text-[var(--text-muted)]">→</span>
                <div className="rounded-xl px-3 py-2 text-left border border-[var(--border)]" style={{ background: 'var(--surface-2)' }}>
                  <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wide">{t.extra.words}</p>
                  <p className="text-xs font-bold text-[var(--text)]">apple · book · water</p>
                </div>
              </div>
            </div>

            {!creating && (
              <button onClick={() => setCreating(true)} className="btn-primary px-6 py-3 text-sm font-semibold">
                {t.extra.createFolder}
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {folders.map((folder, i) => {
                const done = completedUnitsInFolder(folder.name);
                return (
                  <FolderCard
                    key={folder.name}
                    href={`/my-words/${encodeURIComponent(folder.name)}`}
                    color={cardColor(i)}
                    icon="📁"
                    name={folder.name}
                    subtitle={t.libraryPage.unitCount(folder.collectionCount) + (done > 0 ? ` · ✅ ${done}/${folder.collectionCount}` : '')}
                  />
                );
              })}
            </div>

            {orphaned.length > 0 && (
              <div className="mt-6">
                <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide px-1 mb-3">{t.extra.unfiled}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {orphaned.map((col, i) => (
                    <FolderCard
                      key={col.name}
                      href={`/import?collection=${encodeURIComponent(col.name)}`}
                      color={cardColor(folders.length + i)}
                      icon="📖"
                      name={col.name}
                      subtitle={t.myWords.wordCount(col.count)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {resetConfirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 pb-4 sm:pb-0" onClick={() => setResetConfirm(false)}>
          <div className="bg-[var(--surface)] rounded-2xl w-full max-w-sm p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <p className="text-[var(--text)] font-bold mb-2">{t.extra.resetMyWordsQ}</p>
            <p className="text-sm text-[var(--text-muted)] mb-6">
              {t.extra.resetMyWordsExplain}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setResetConfirm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[var(--text-muted)] bg-[var(--surface-2)]"
              >
                {t.extra.cancel}
              </button>
              <button
                onClick={handleResetProgress}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: 'var(--danger)' }}
              >
                {t.extra.reset}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
