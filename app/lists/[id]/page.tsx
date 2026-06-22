'use client';
import { SectionLoader } from '@/components/Loader';
import { use, useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import {
  getCustomLists, saveCustomList, removeWordFromList,
  addWordToList, getCustomListWords, isWordInList,
} from '@/lib/storage';
import { speak } from '@/lib/speech';
import type { CustomList, WordItem, WordCollection } from '@/lib/types';

interface FullWord extends WordItem {
  collectionName: string;
  topic: string;
  dayNumber: number;
}

function searchWords(
  query: string,
  collections: WordCollection[],
  limit = 20,
): FullWord[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  const results: FullWord[] = [];
  const seen = new Set<string>();
  for (const col of collections) {
    for (const day of col.days) {
      for (const w of day.words) {
        if (seen.has(w.word)) continue;
        if (
          w.word.toLowerCase().includes(q) ||
          w.translation.toLowerCase().includes(q) ||
          w.definition.toLowerCase().includes(q)
        ) {
          results.push({ ...w, collectionName: col.name, topic: day.topic, dayNumber: day.dayNumber });
          seen.add(w.word);
          if (results.length >= limit) return results;
        }
      }
    }
  }
  return results;
}

export default function ListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { collections, collectionsLoaded } = useAppStore();

  const [list, setList] = useState<CustomList | null>(null);
  const [words, setWords] = useState<FullWord[]>([]);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FullWord[]>([]);
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(() => {
    const found = getCustomLists().find(l => l.id === id);
    if (!found) return;
    setList(found);
    if (collectionsLoaded && collections.length > 0) {
      setWords(getCustomListWords(id, collections));
    }
  }, [id, collectionsLoaded, collections]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    window.addEventListener('lexivo-sync', reload);
    return () => window.removeEventListener('lexivo-sync', reload);
  }, [reload]);

  useEffect(() => {
    if (!collectionsLoaded || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setSearchResults(searchWords(searchQuery, collections));
  }, [searchQuery, collectionsLoaded, collections]);

  const handleRename = () => {
    if (!list || !nameInput.trim()) return;
    const updated = { ...list, name: nameInput.trim() };
    saveCustomList(updated);
    setList(updated);
    setEditingName(false);
  };

  const handleRemove = (word: string) => {
    removeWordFromList(id, word);
    reload();
  };

  const handleToggleWord = (word: string) => {
    if (isWordInList(id, word)) {
      removeWordFromList(id, word);
    } else {
      addWordToList(id, word);
    }
    reload();
    // Keep search results live — just re-render
  };

  if (!collectionsLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-4xl animate-bounce">📋</div>
      </div>
    );
  }

  if (!list) {
    return (
      <div className="p-6 text-center space-y-4">
        <p className="text-[var(--text-muted)]">List not found.</p>
        <Link href="/lists" className="btn-primary inline-block">← My Lists</Link>
      </div>
    );
  }

  const enc = encodeURIComponent(id);
  const hasEnough = list.words.length >= 2;
  const hasForQuiz = list.words.length >= 3;

  return (
    <div className="flex flex-col min-h-screen animate-fade-in">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border)]">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-3 hover:text-[var(--text)] transition-colors"
        >
          ← My Lists
        </button>

        {/* Name row */}
        {editingName ? (
          <div className="flex gap-2 items-center">
            <input
              autoFocus
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setEditingName(false); }}
              className="flex-1 text-xl font-bold px-3 py-1.5 rounded-xl border border-[var(--primary)] bg-[var(--surface-2)] text-[var(--text)] focus:outline-none"
            />
            <button onClick={handleRename} className="btn-primary text-sm px-3 py-1.5">Save</button>
            <button onClick={() => setEditingName(false)} className="btn-secondary text-sm px-3 py-1.5">✕</button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[var(--text)] flex-1 truncate">{list.name}</h1>
            <button
              onClick={() => { setNameInput(list.name); setEditingName(true); }}
              className="w-8 h-8 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-sm hover:bg-[var(--primary-bg)] transition-colors"
              aria-label="Rename list"
            >
              ✏️
            </button>
          </div>
        )}
        <p className="text-sm text-[var(--text-muted)] mt-0.5">{list.words.length} word{list.words.length !== 1 ? 's' : ''}</p>

        {/* Study buttons */}
        {list.words.length > 0 && (
          <div className="flex gap-2 flex-wrap mt-3">
            <StudyBtn href={`/flashcards?list=${enc}`} icon="🃏" label="Cards" disabled={!hasEnough} />
            <StudyBtn href={`/quiz?list=${enc}`}       icon="❓" label="Quiz"  disabled={!hasForQuiz} />
            <StudyBtn href={`/matching?list=${enc}`}   icon="🎯" label="Match" disabled={!hasEnough} />
            <StudyBtn href={`/pronunciation?list=${enc}`} icon="🎙️" label="Speak" disabled={!hasEnough} />
          </div>
        )}
      </div>

      {/* Word list */}
      <div className="flex-1 p-4 space-y-4">
        {words.length === 0 ? (
          <div className="text-center py-10">
            <div className="text-5xl mb-3">📭</div>
            <p className="text-[var(--text-muted)] text-sm mb-4">No words yet. Use the search below to add some.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {words.map(w => (
              <div key={w.word} className="card flex items-center gap-3 py-3 px-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/word/${encodeURIComponent(w.word)}`}
                      className="font-semibold text-[var(--text)] text-sm hover:text-[var(--primary)] transition-colors"
                    >
                      {w.word}
                    </Link>
                    <span className="text-xs text-[var(--text-muted)] italic">{w.partOfSpeech}</span>
                  </div>
                  <p className="text-xs text-[var(--primary)] font-medium mt-0.5 truncate">{w.translation}</p>
                  <p className="text-xs text-[var(--text-muted)] truncate">{w.collectionName} · Unit {w.dayNumber}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => speak(w.word)}
                    className="w-8 h-8 rounded-full bg-[var(--primary-bg)] flex items-center justify-center text-sm hover:bg-[var(--primary)] hover:text-white transition-colors"
                    aria-label="Listen to pronunciation"
                  >
                    🔊
                  </button>
                  <button
                    onClick={() => handleRemove(w.word)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm text-[var(--text-muted)] hover:bg-red-50 hover:text-[var(--danger)] transition-colors"
                    aria-label="Remove from list"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add words panel */}
        <div className="rounded-2xl border border-[var(--border)] overflow-hidden">
          <button
            onClick={() => {
              setAddPanelOpen(o => !o);
              if (!addPanelOpen) setTimeout(() => searchRef.current?.focus(), 100);
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--surface-2)] transition-colors"
          >
            <span className="text-lg">🔍</span>
            <span className="font-semibold text-[var(--text)] text-sm flex-1">Add words</span>
            <span className="text-xs text-[var(--text-muted)]">{addPanelOpen ? '▲' : '▼'}</span>
          </button>

          {addPanelOpen && (
            <div className="border-t border-[var(--border)] p-4 space-y-3 animate-fade-in">
              <input
                ref={searchRef}
                type="text"
                placeholder="Search by word, translation, or definition…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] text-sm focus:outline-none focus:border-[var(--primary)]"
              />

              {searchQuery.trim() && searchResults.length === 0 && (
                <p className="text-sm text-[var(--text-muted)] text-center py-2">No results for "{searchQuery}"</p>
              )}

              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {searchResults.map(w => {
                  const inList = isWordInList(id, w.word);
                  return (
                    <div key={w.word} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[var(--surface-2)] transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[var(--text)] truncate">{w.word}</p>
                        <p className="text-xs text-[var(--text-muted)] truncate">{w.translation} · {w.collectionName}</p>
                      </div>
                      <button
                        onClick={() => handleToggleWord(w.word)}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                          inList
                            ? 'bg-green-50 text-[var(--success)] border border-[var(--success)]'
                            : 'bg-[var(--primary-bg)] text-[var(--primary)] border border-[var(--primary)] hover:bg-[var(--primary)] hover:text-white'
                        }`}
                      >
                        {inList ? '✓ Added' : '+ Add'}
                      </button>
                    </div>
                  );
                })}
              </div>

              {!searchQuery.trim() && (
                <p className="text-xs text-[var(--text-muted)] text-center">
                  Type to search across all {collections.reduce((a, c) => a + c.days.reduce((b, d) => b + d.words.length, 0), 0)} words
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StudyBtn({ href, icon, label, disabled }: { href: string; icon: string; label: string; disabled?: boolean }) {
  if (disabled) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[var(--surface-2)] text-[var(--text-muted)] opacity-50 cursor-not-allowed">
        {icon} {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[var(--primary-bg)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white transition-colors"
    >
      {icon} {label}
    </Link>
  );
}
