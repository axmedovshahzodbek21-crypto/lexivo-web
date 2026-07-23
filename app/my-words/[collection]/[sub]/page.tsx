'use client';
import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/useTranslation';
import { getImportedWordsByCollection, deleteImportedWord, deleteImportedCollection } from '@/lib/storage';
import { speakText } from '@/lib/speech';
import type { ImportedWord } from '@/lib/types';

interface Props {
  params: Promise<{ collection: string; sub: string }>;
}

// Words page for a collection inside a folder: /my-words/[folder]/[collection]
export default function FolderCollectionPage({ params }: Props) {
  const { collection: encodedFolder, sub: encodedSub } = use(params);
  const folder = decodeURIComponent(encodedFolder);
  const collectionName = decodeURIComponent(encodedSub);
  const router = useRouter();
  const t = useTranslation();
  const [words, setWords] = useState<ImportedWord[]>([]);

  useEffect(() => {
    const load = () => setWords(getImportedWordsByCollection(collectionName, folder));
    load();
    window.addEventListener('lexivo-sync', load);
    return () => window.removeEventListener('lexivo-sync', load);
  }, [folder, collectionName]);

  function handleDelete(word: string) {
    if (!confirm(t.myWords.deleteConfirm)) return;
    deleteImportedWord(word, collectionName, folder);
    setWords(getImportedWordsByCollection(collectionName, folder));
  }

  function handleDeleteCollection() {
    if (!confirm(`Delete the "${collectionName}" collection and all its words?`)) return;
    deleteImportedCollection(collectionName, folder);
    router.push(`/my-words/${encodeURIComponent(folder)}`);
  }

  const studyParam = `source=my-words&myCollection=${encodeURIComponent(collectionName)}&myFolder=${encodeURIComponent(folder)}`;

  return (
    <div className="flex flex-col min-h-screen animate-fade-in pb-24">
      <div className="flex items-center gap-3 p-4 border-b border-[var(--border)]">
        <button onClick={() => router.back()} className="btn-icon text-lg" aria-label="Go back">←</button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-[var(--text)] truncate">{collectionName}</h1>
          <p className="text-xs text-[var(--text-muted)] truncate">
            <span className="text-[var(--primary)]">📁 {folder}</span> · {t.myWords.wordCount(words.length)}
          </p>
        </div>
        <button
          onClick={handleDeleteCollection}
          className="btn-icon text-base text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
          aria-label="Delete collection"
        >🗑️</button>
        <Link
          href={`/import?folder=${encodeURIComponent(folder)}&collection=${encodeURIComponent(collectionName)}`}
          className="w-9 h-9 rounded-full bg-[var(--primary-bg)] flex items-center justify-center text-lg font-bold text-[var(--primary)]"
          aria-label={t.myWords.addWords}
        >+</Link>
      </div>

      <div className="p-4 space-y-4">
        {words.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="text-6xl">✍️</div>
            <p className="text-[var(--text-muted)] text-sm">{t.myWords.empty}</p>
            <Link
              href={`/import?folder=${encodeURIComponent(folder)}&collection=${encodeURIComponent(collectionName)}`}
              className="btn-primary px-6 py-3 text-sm font-semibold"
            >
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
                      {w.example3 && <p className="text-xs italic text-[var(--text)] mt-0.5">"{w.example3}"</p>}
                      {w.example3Translation && <p className="text-xs text-[var(--text-muted)] pl-2">↳ {w.example3Translation}</p>}
                      {w.example4 && <p className="text-xs italic text-[var(--text)] mt-0.5">"{w.example4}"</p>}
                      {w.example4Translation && <p className="text-xs text-[var(--text-muted)] pl-2">↳ {w.example4Translation}</p>}
                      {w.example5 && <p className="text-xs italic text-[var(--text)] mt-0.5">"{w.example5}"</p>}
                      {w.example5Translation && <p className="text-xs text-[var(--text-muted)] pl-2">↳ {w.example5Translation}</p>}
                    </div>
                    <button onClick={() => handleDelete(w.word)} className="text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors text-sm shrink-0 mt-0.5" aria-label="Delete word">🗑️</button>
                  </div>
                </div>
              ))}
            </div>

            <Link
              href={`/import?folder=${encodeURIComponent(folder)}&collection=${encodeURIComponent(collectionName)}`}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl border-2 border-dashed border-[var(--border)] text-sm font-medium text-[var(--text-muted)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
            >
              <span>+</span>
              <span>{t.myWords.addWords}</span>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
