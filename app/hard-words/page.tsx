'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { getHardWords, removeHardWord, saveLearnedWord, addSRSWord as storeSRSWord } from '@/lib/storage';
import { createSRSWord } from '@/lib/srs';
import { speak } from '@/lib/speech';
import type { WordItem, WordCollection } from '@/lib/types';

interface HardWord extends WordItem {
  collectionName: string;
  topic: string;
  dayNumber: number;
}

function findHardWords(collections: WordCollection[], hardList: string[]): HardWord[] {
  const set = new Set(hardList);
  const found: HardWord[] = [];
  const seen = new Set<string>();
  for (const col of collections) {
    for (const day of col.days) {
      for (const word of day.words) {
        if (set.has(word.word) && !seen.has(word.word)) {
          found.push({ ...word, collectionName: col.name, topic: day.topic, dayNumber: day.dayNumber });
          seen.add(word.word);
        }
      }
    }
  }
  found.sort((a, b) => hardList.indexOf(a.word) - hardList.indexOf(b.word));
  return found;
}

export default function HardWordsPage() {
  const router = useRouter();
  const { collections, collectionsLoaded } = useAppStore();

  const [hardList, setHardList] = useState<string[]>([]);
  const [words, setWords] = useState<HardWord[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [learned, setLearned] = useState<Set<string>>(new Set());

  const reload = useCallback(() => {
    const list = getHardWords();
    setHardList(list);
    if (collectionsLoaded && collections.length > 0) {
      setWords(findHardWords(collections, list));
    }
  }, [collectionsLoaded, collections]);

  useEffect(() => { reload(); }, [reload]);

  const handleRemove = (word: string) => {
    removeHardWord(word);
    reload();
  };

  const handleMarkLearned = (w: HardWord) => {
    saveLearnedWord({
      word: w.word,
      translation: w.translation,
      collectionName: w.collectionName,
      topic: w.topic,
      dayNumber: w.dayNumber,
      learnedAt: new Date().toISOString(),
    });
    storeSRSWord(createSRSWord(w, w.collectionName, w.dayNumber, w.topic));
    removeHardWord(w.word);
    setLearned(prev => new Set(prev).add(w.word));
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

  if (!collectionsLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-4xl animate-bounce">😓</div>
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
          ← Back
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[var(--text)]">😓 Hard Words</h1>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">{hardList.length} words to master</p>
          </div>
          {hardList.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <Link href="/flashcards?hard=true" className="btn-secondary text-sm px-3 py-1.5">🃏 Cards</Link>
              <Link href="/learn?hard=true" className="btn-secondary text-sm px-3 py-1.5">📖 Study</Link>
            </div>
          )}
        </div>

        {hardList.length > 0 && (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs text-amber-700">
              💡 These words were marked <strong>Too Hard</strong> during learning. Study them here, then mark as learned to add them to your SRS review cycle.
            </p>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 p-4">
        {hardList.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-xl font-bold text-[var(--text)] mb-2">No hard words!</h2>
            <p className="text-[var(--text-muted)] text-sm mb-6">
              Words you tap <strong>Too Hard</strong> while learning will appear here for focused practice.
            </p>
            <Link href="/learn" className="btn-primary inline-block">Start Learning</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {words.map(w => (
              <HardWordCard
                key={w.word}
                word={w}
                expanded={expanded.has(w.word)}
                justLearned={learned.has(w.word)}
                onToggle={() => toggleExpand(w.word)}
                onRemove={() => handleRemove(w.word)}
                onMarkLearned={() => handleMarkLearned(w)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HardWordCard({
  word, expanded, justLearned, onToggle, onRemove, onMarkLearned,
}: {
  word: HardWord;
  expanded: boolean;
  justLearned: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onMarkLearned: () => void;
}) {
  return (
    <div className="card border-l-4 border-l-[var(--danger)] transition-all">
      {/* Top row */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0" onClick={onToggle} style={{ cursor: 'pointer' }}>
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
            title="Listen"
          >🔊</button>
          <button
            onClick={onRemove}
            className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-sm hover:bg-red-100 transition-colors"
            title="Remove from hard list"
          >✕</button>
        </div>
      </div>

      {/* Expand toggle */}
      <button
        onClick={onToggle}
        className="text-xs text-[var(--primary)] font-medium hover:underline"
      >
        {expanded ? '▲ Less' : '▼ Definition & examples'}
      </button>
      <Link
        href={`/word/${encodeURIComponent(word.word)}`}
        className="mt-2 text-xs text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors block text-right"
      >
        Full details →
      </Link>

      {/* Expanded content */}
      {expanded && (
        <div className="mt-3 space-y-3 animate-fade-in border-t border-[var(--border)] pt-3">
          <p className="text-sm text-[var(--text)]">{word.definition}</p>

          <div className="space-y-2">
            {[word.example1, word.example2, word.example3].filter(Boolean).map((ex, i) => (
              <div key={i} className="bg-[var(--surface-2)] rounded-xl p-3">
                <p className="text-xs text-[var(--text-muted)] mb-1">Example {i + 1}</p>
                <p className="text-sm italic text-[var(--text)]">"{ex}"</p>
                {i === 2 && word.example3Translation && (
                  <p className="text-xs text-[var(--primary)] mt-1">{word.example3Translation}</p>
                )}
              </div>
            ))}
          </div>

          <div className="bg-amber-50 rounded-xl p-3 space-y-1">
            <p className="text-xs font-semibold text-amber-700 mb-1">🗺️ Situations (O'zbek)</p>
            {[word.example1Situation, word.example2Situation, word.example3Situation].filter(Boolean).map((s, i) => (
              <p key={i} className="text-xs text-amber-900">{s}</p>
            ))}
          </div>

          <div className="text-xs text-[var(--text-muted)]">
            From: {word.collectionName} · Unit {word.dayNumber}
          </div>
        </div>
      )}

      {/* Mark as learned */}
      <button
        onClick={onMarkLearned}
        className="mt-3 w-full py-2 rounded-xl bg-green-50 border border-[var(--success)] text-[var(--success)] text-sm font-semibold hover:bg-green-100 transition-colors"
      >
        ✓ I've got it — Mark as Learned
      </button>
    </div>
  );
}
