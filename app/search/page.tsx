'use client';
import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { searchWords } from '@/lib/data';
import { speak } from '@/lib/speech';
import { toggleStarred, isStarred } from '@/lib/storage';
import Link from 'next/link';
import type { WordItem } from '@/lib/types';

interface SearchResult extends WordItem {
  collectionName: string;
  topic: string;
}

export default function SearchPage() {
  const { collections } = useAppStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [starredMap, setStarredMap] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (query.length < 1) {
      setResults([]);
      return;
    }
    const found = searchWords(collections, query);
    setResults(found);
    // Build starred map
    const map: Record<string, boolean> = {};
    found.forEach(r => { map[r.word] = isStarred(r.word); });
    setStarredMap(map);
  }, [query, collections]);

  const handleStar = (word: string) => {
    const nowStarred = toggleStarred(word);
    setStarredMap(m => ({ ...m, [word]: nowStarred }));
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Search header */}
      <div className="sticky top-0 bg-[var(--background)] p-4 z-10 border-b border-[var(--border)]">
        <h1 className="font-bold text-xl mb-3">🔍 Search</h1>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search words, Uzbek, definitions…"
            className="w-full pl-11 pr-4 py-3 rounded-xl bg-[var(--surface-2)] border-2 border-transparent focus:border-[var(--primary)] outline-none text-[var(--text)] transition-colors"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              ✕
            </button>
          )}
        </div>
        {results.length > 0 && (
          <p className="text-xs text-[var(--text-muted)] mt-2">{results.length} results</p>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 p-4 space-y-2">
        {query.length === 0 && (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">🔎</div>
            <p className="text-[var(--text-muted)]">Search across 2,500+ words</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Try searching in English or Uzbek</p>
          </div>
        )}

        {query.length > 0 && results.length === 0 && (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">😕</div>
            <p className="text-[var(--text-muted)]">No results for "{query}"</p>
          </div>
        )}

        {results.map(result => (
          <div
            key={`${result.collectionName}-${result.word}`}
            className="card cursor-pointer hover:border-[var(--primary)] transition-colors"
            onClick={() => setExpanded(expanded === result.word ? null : result.word)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-[var(--text)]">{result.word}</h3>
                  <span className="text-xs text-[var(--text-muted)]">{result.partOfSpeech}</span>
                  <span className="badge text-xs">{result.collectionName.split(' ')[0]}</span>
                </div>
                <p className="text-[var(--primary)] font-medium text-sm">{result.translation}</p>
                {expanded !== result.word && (
                  <p className="text-xs text-[var(--text-muted)] mt-1 truncate">{result.definition}</p>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={e => { e.stopPropagation(); speak(result.word); }}
                  className="w-8 h-8 rounded-full bg-[var(--primary-bg)] flex items-center justify-center text-sm hover:bg-[var(--primary)] hover:text-white transition-colors"
                >
                  🔊
                </button>
                <button
                  onClick={e => { e.stopPropagation(); handleStar(result.word); }}
                  className="w-8 h-8 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-sm"
                >
                  {starredMap[result.word] ? '⭐' : '☆'}
                </button>
                <Link
                  href={`/word/${encodeURIComponent(result.word)}`}
                  onClick={e => e.stopPropagation()}
                  className="w-8 h-8 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-sm hover:bg-[var(--primary-bg)] transition-colors"
                  title="Word details"
                >
                  →
                </Link>
              </div>
            </div>

            {expanded === result.word && (
              <div className="mt-3 space-y-2 animate-fade-in border-t border-[var(--border)] pt-3">
                <p className="text-sm text-[var(--text)]">{result.definition}</p>
                <div className="text-xs text-[var(--text-muted)]">{result.pronunciation}</div>
                <div className="bg-[var(--primary-bg)] rounded-xl p-3">
                  <p className="text-xs italic text-[var(--text-muted)]">"{result.example1}"</p>
                </div>
                {result.example1Situation && (
                  <div className="bg-amber-50 rounded-xl p-3">
                    <p className="text-xs text-amber-600 mb-1">🗺️ Holat (Uzbek)</p>
                    <p className="text-xs text-amber-900">{result.example1Situation}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
