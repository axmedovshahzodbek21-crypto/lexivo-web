'use client';
import { PageLoader, SectionLoader } from '@/components/Loader';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { getStarredWords, toggleStarred } from '@/lib/storage';
import { speak } from '@/lib/speech';
import type { WordItem, WordCollection } from '@/lib/types';
import { useTranslation } from '@/lib/useTranslation';

interface StarredWord extends WordItem {
  collectionName: string;
  topic: string;
  dayNumber: number;
}

function findStarredWords(collections: WordCollection[], starredList: string[]): StarredWord[] {
  const set = new Set(starredList);
  const found: StarredWord[] = [];
  for (const col of collections) {
    for (const day of col.days) {
      for (const word of day.words) {
        if (set.has(word.word)) {
          found.push({ ...word, collectionName: col.name, topic: day.topic, dayNumber: day.dayNumber });
        }
      }
    }
  }
  // Preserve order of starredList
  found.sort((a, b) => starredList.indexOf(a.word) - starredList.indexOf(b.word));
  return found;
}

export default function StarredPage() {
  const router = useRouter();
  const t = useTranslation();
  const { collections, collectionsLoaded } = useAppStore();

  const [starredList, setStarredList] = useState<string[]>([]);
  const [words, setWords] = useState<StarredWord[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const reload = useCallback(() => {
    const list = getStarredWords();
    setStarredList(list);
    if (collectionsLoaded && collections.length > 0) {
      setWords(findStarredWords(collections, list));
    }
  }, [collectionsLoaded, collections]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    window.addEventListener('lexivo-sync', reload);
    return () => window.removeEventListener('lexivo-sync', reload);
  }, [reload]);

  const handleUnstar = (word: string) => {
    toggleStarred(word);
    reload();
  };

  const toggleExpand = (word: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(word)) next.delete(word);
      else next.add(word);
      return next;
    });
  };

  const filtered = search.trim()
    ? words.filter(w =>
        w.word.toLowerCase().includes(search.toLowerCase()) ||
        w.translation.toLowerCase().includes(search.toLowerCase())
      )
    : words;

  if (!collectionsLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <SectionLoader />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen animate-fade-in">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border)]">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-3 hover:text-[var(--text)] transition-colors"
        >
          {t.common.back}
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[var(--text)]">{t.starred.title}</h1>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">{starredList.length} {t.starred.saved}</p>
          </div>
          {starredList.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <Link href="/flashcards?starred=true" className="btn-secondary text-sm px-3 py-1.5">{t.starred.cards}</Link>
              <Link href="/quiz?starred=true" className="btn-secondary text-sm px-3 py-1.5">{t.starred.quiz}</Link>
              <Link href="/matching?starred=true" className="btn-secondary text-sm px-3 py-1.5">🎯 Match</Link>
            </div>
          )}
        </div>

        {/* Search */}
        {starredList.length > 4 && (
          <div className="mt-3">
            <input
              type="text"
              placeholder={t.starred.filterPlaceholder}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full px-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] text-sm focus:outline-none focus:border-[var(--primary)]"
            />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 p-4">
        {starredList.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">☆</div>
            <h2 className="text-xl font-bold text-[var(--text)] mb-2">{t.starred.empty}</h2>
            <p className="text-[var(--text-muted)] text-sm mb-6">
              {t.starred.emptyHelper}
            </p>
            <Link href="/learn" className="btn-primary inline-block">{t.starred.startLearning}</Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-[var(--text-muted)]">{t.starred.noResults(search)}</div>
        ) : (
          <div className="space-y-3">
            {filtered.map(w => (
              <WordCard
                key={w.word}
                word={w}
                expanded={expanded.has(w.word)}
                onToggle={() => toggleExpand(w.word)}
                onUnstar={() => handleUnstar(w.word)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function WordCard({
  word, expanded, onToggle, onUnstar,
}: {
  word: StarredWord;
  expanded: boolean;
  onToggle: () => void;
  onUnstar: () => void;
}) {
  const t = useTranslation();
  return (
    <div className="card transition-all">
      {/* Top row */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0" onClick={onToggle} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }} role="button" tabIndex={0} style={{ cursor: 'pointer' }}>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-[var(--text)] text-lg">{word.word}</h3>
            <span className="text-xs text-[var(--text-muted)] italic">{word.partOfSpeech}</span>
            <span className="badge text-xs">{word.topic}</span>
          </div>
          <p className="text-sm text-[var(--text-muted)]">{word.pronunciation}</p>
          <p className="text-base font-semibold text-[var(--primary)] mt-1">{word.translation}</p>
        </div>
        <div className="flex flex-col gap-2 flex-shrink-0">
          <button
            onClick={() => speak(word.word)}
            className="w-8 h-8 rounded-full bg-[var(--primary-bg)] flex items-center justify-center text-sm hover:bg-[var(--primary)] hover:text-white transition-colors"
            aria-label="Listen to pronunciation"
          >🔊</button>
          <button
            onClick={onUnstar}
            className="w-8 h-8 rounded-full bg-yellow-50 flex items-center justify-center text-sm hover:bg-red-50 transition-colors"
            aria-label="Remove from starred"
          >⭐</button>
        </div>
      </div>

      {/* Expand toggle */}
      <button
        onClick={onToggle}
        className="text-xs text-[var(--primary)] font-medium hover:underline"
      >
        {expanded ? t.starred.showLess : t.starred.showMore}
      </button>
      <Link
        href={`/word/${encodeURIComponent(word.word)}`}
        className="mt-2 text-xs text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors block text-right"
      >
        {t.starred.fullDetails}
      </Link>

      {/* Expanded content */}
      {expanded && (
        <div className="mt-3 space-y-3 animate-fade-in border-t border-[var(--border)] pt-3">
          <p className="text-sm text-[var(--text)]">{word.definition}</p>

          <div className="space-y-2">
            {[word.example1, word.example2, word.example3].filter(Boolean).map((ex, i) => (
              <div key={i} className="bg-[var(--surface-2)] rounded-xl p-3">
                <p className="text-xs text-[var(--text-muted)] mb-1">{t.starred.example(i + 1)}</p>
                <p className="text-sm italic text-[var(--text)]">"{ex}"</p>
                {i === 2 && word.example3Translation && (
                  <p className="text-xs text-[var(--primary)] mt-1">{word.example3Translation}</p>
                )}
              </div>
            ))}
          </div>

          <div className="text-xs text-[var(--text-muted)]">
            {t.starred.from(word.collectionName, word.dayNumber)}
          </div>
        </div>
      )}
    </div>
  );
}

