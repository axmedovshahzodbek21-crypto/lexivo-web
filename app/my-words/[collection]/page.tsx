'use client';
import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/useTranslation';
import {
  getImportedWordsByCollection,
  deleteImportedWord,
  deleteImportedCollection,
  deleteImportedFolder,
  getCollectionsByFolder,
  getImportedFolders,
} from '@/lib/storage';
import { speakText } from '@/lib/speech';
import type { ImportedWord, ImportedCollection } from '@/lib/types';

interface Props {
  params: Promise<{ collection: string }>;
}

export default function SlugPage({ params }: Props) {
  const { collection: encodedSlug } = use(params);
  const slug = decodeURIComponent(encodedSlug);
  const router = useRouter();
  const t = useTranslation();

  // Determine if slug is a folder or a root collection
  const [mode, setMode] = useState<'loading' | 'folder' | 'collection'>('loading');
  const [words, setWords] = useState<ImportedWord[]>([]);
  const [folderCollections, setFolderCollections] = useState<ImportedCollection[]>([]);

  useEffect(() => {
    const resolve = () => {
      const folders = getImportedFolders();
      if (folders.some(f => f.name === slug)) {
        setMode('folder');
        setFolderCollections(getCollectionsByFolder(slug));
      } else {
        setMode('collection');
        setWords(getImportedWordsByCollection(slug));
      }
    };
    resolve();
    window.addEventListener('lexivo-sync', resolve);
    return () => window.removeEventListener('lexivo-sync', resolve);
  }, [slug]);

  // ── FOLDER VIEW ───────────────────────────────────────────────────────────────

  function handleDeleteFolder() {
    if (!confirm(`Delete the entire "${slug}" folder and all its collections?`)) return;
    deleteImportedFolder(slug);
    router.push('/my-words');
  }

  if (mode === 'folder') {
    return (
      <div className="flex flex-col min-h-screen animate-fade-in pb-24">
        <div className="flex items-center gap-3 p-4 border-b border-[var(--border)]">
          <button onClick={() => router.back()} className="btn-icon text-lg" aria-label="Go back">←</button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xl">📁</span>
              <h1 className="font-bold text-[var(--text)] truncate">{slug}</h1>
            </div>
            <p className="text-xs text-[var(--text-muted)]">{folderCollections.length} collection{folderCollections.length !== 1 ? 's' : ''}</p>
          </div>
          <Link
            href={`/import?folder=${encodeURIComponent(slug)}`}
            className="w-9 h-9 rounded-full bg-[var(--primary-bg)] flex items-center justify-center text-lg font-bold text-[var(--primary)]"
            aria-label="Add collection to folder"
          >+</Link>
          <button
            onClick={handleDeleteFolder}
            className="btn-icon text-base text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
            aria-label="Delete folder"
          >🗑️</button>
        </div>

        <div className="p-4 space-y-3">
          {folderCollections.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
              <div className="text-6xl">📂</div>
              <p className="text-[var(--text-muted)] text-sm">No collections yet</p>
              <Link href={`/import?folder=${encodeURIComponent(slug)}`} className="btn-primary px-6 py-3 text-sm font-semibold">
                Add collection
              </Link>
            </div>
          ) : (
            folderCollections.map(col => (
              <Link
                key={col.name}
                href={`/my-words/${encodeURIComponent(slug)}/${encodeURIComponent(col.name)}`}
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

  // ── ROOT COLLECTION VIEW ──────────────────────────────────────────────────────

  function handleDelete(word: string) {
    if (!confirm(t.myWords.deleteConfirm)) return;
    deleteImportedWord(word, slug);
    setWords(getImportedWordsByCollection(slug));
  }

  function handleDeleteCollection() {
    if (!confirm(`Delete the entire "${slug}" collection and all its words?`)) return;
    deleteImportedCollection(slug);
    router.push('/my-words');
  }

  if (mode === 'loading') return null;

  const studyParam = `source=my-words&myCollection=${encodeURIComponent(slug)}`;

  return (
    <div className="flex flex-col min-h-screen animate-fade-in pb-24">
      <div className="flex items-center gap-3 p-4 border-b border-[var(--border)]">
        <button onClick={() => router.back()} className="btn-icon text-lg" aria-label="Go back">←</button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-[var(--text)] truncate">{slug}</h1>
          <p className="text-xs text-[var(--text-muted)]">{t.myWords.wordCount(words.length)}</p>
        </div>
        <button
          onClick={handleDeleteCollection}
          className="btn-icon text-base text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
          aria-label="Delete collection"
        >🗑️</button>
        <Link
          href={`/import?collection=${encodeURIComponent(slug)}`}
          className="w-9 h-9 rounded-full bg-[var(--primary-bg)] flex items-center justify-center text-lg font-bold text-[var(--primary)]"
          aria-label={t.myWords.addWords}
        >+</Link>
      </div>

      <div className="p-4 space-y-4">
        {words.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="text-6xl">✍️</div>
            <p className="text-[var(--text-muted)] text-sm">{t.myWords.empty}</p>
            <Link href={`/import?collection=${encodeURIComponent(slug)}`} className="btn-primary px-6 py-3 text-sm font-semibold">
              {t.myWords.addWords}
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Link href={`/learn?${studyParam}`} className="flex flex-col items-center gap-1.5 py-3 rounded-2xl text-center transition-colors" style={{ background: 'rgba(108,99,255,0.1)', border: '1.5px solid rgba(108,99,255,0.3)' }}>
                <span className="text-2xl">📖</span>
                <span className="text-xs font-semibold" style={{ color: 'var(--primary)' }}>Learn</span>
              </Link>
              <Link href={`/flashcards?${studyParam}`} className="flex flex-col items-center gap-1.5 py-3 rounded-2xl text-center transition-colors" style={{ background: 'rgba(255,107,53,0.1)', border: '1.5px solid rgba(255,107,53,0.3)' }}>
                <span className="text-2xl">🃏</span>
                <span className="text-xs font-semibold" style={{ color: '#FF6B35' }}>Flashcards</span>
              </Link>
              <Link href={`/quiz?${studyParam}`} className="flex flex-col items-center gap-1.5 py-3 rounded-2xl text-center transition-colors" style={{ background: 'rgba(245,158,11,0.1)', border: '1.5px solid rgba(245,158,11,0.3)' }}>
                <span className="text-2xl">❓</span>
                <span className="text-xs font-semibold" style={{ color: 'var(--warning)' }}>Quiz</span>
              </Link>
              <Link href={`/matching?${studyParam}`} className="flex flex-col items-center gap-1.5 py-3 rounded-2xl text-center transition-colors" style={{ background: 'rgba(16,185,129,0.1)', border: '1.5px solid rgba(16,185,129,0.3)' }}>
                <span className="text-2xl">🔗</span>
                <span className="text-xs font-semibold" style={{ color: 'var(--success)' }}>Match</span>
              </Link>
            </div>

            <div className="space-y-2">
              {words.map((w, i) => (
                <div key={i} className="card space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[var(--text)]">{w.word}</span>
                        <button onClick={() => speakText(w.word, w.language)} className="w-6 h-6 rounded-full bg-[var(--primary-bg)] flex items-center justify-center text-xs hover:bg-[var(--primary)] hover:text-white transition-colors shrink-0" aria-label="Listen">🔊</button>
                      </div>
                      <p className="text-sm font-medium text-[var(--primary)] mt-0.5">{w.translation}</p>
                      {w.definition && <p className="text-xs text-[var(--text-muted)] mt-1">{w.definition}</p>}
                      {w.example1 && <p className="text-xs italic text-[var(--text)] mt-1">"{w.example1}"</p>}
                      {w.example1Translation && <p className="text-xs text-[var(--text-muted)] pl-2">↳ {w.example1Translation}</p>}
                      {w.example2 && <p className="text-xs italic text-[var(--text)] mt-0.5">"{w.example2}"</p>}
                      {w.example2Translation && <p className="text-xs text-[var(--text-muted)] pl-2">↳ {w.example2Translation}</p>}
                    </div>
                    <button onClick={() => handleDelete(w.word)} className="text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors text-sm shrink-0 mt-0.5" aria-label="Delete word">🗑️</button>
                  </div>
                </div>
              ))}
            </div>

            <Link href={`/import?collection=${encodeURIComponent(slug)}`} className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl border-2 border-dashed border-[var(--border)] text-sm font-medium text-[var(--text-muted)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors">
              <span>+</span>
              <span>{t.myWords.addWords}</span>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
