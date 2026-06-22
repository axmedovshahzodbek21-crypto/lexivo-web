'use client';
import { PageLoader } from '@/components/Loader';
import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { speak } from '@/lib/speech';
import {
  toggleStarred, isStarred, addHardWord, removeHardWord, getHardWords,
  getLearnedWords, getSRSWords, getCustomLists, addWordToList, removeWordFromList, isWordInList,
  saveCustomList,
} from '@/lib/storage';
import { stageLabel, stageColor } from '@/lib/srs';
import type { WordCollection, CustomList } from '@/lib/types';

interface FullWord {
  word: string;
  partOfSpeech: string;
  pronunciation: string;
  translation: string;
  definition: string;
  example1: string;
  example1Situation: string;
  example2: string;
  example2Situation: string;
  example3: string;
  example3Translation: string;
  example3Situation: string;
  collectionName: string;
  topic: string;
  dayNumber: number;
}

function findWord(collections: WordCollection[], wordText: string): FullWord | null {
  for (const col of collections) {
    for (const day of col.days) {
      for (const w of day.words) {
        if (w.word.toLowerCase() === wordText.toLowerCase()) {
          return { ...w, collectionName: col.name, topic: day.topic, dayNumber: day.dayNumber };
        }
      }
    }
  }
  return null;
}

export default function WordDetailPage({ params }: { params: Promise<{ word: string }> }) {
  const { word: encodedWord } = use(params);
  const wordText = decodeURIComponent(encodedWord);
  const router = useRouter();
  const { collections, collectionsLoaded } = useAppStore();

  const [word, setWord] = useState<FullWord | null>(null);
  const [starred, setStarred] = useState(false);
  const [isHard, setIsHard] = useState(false);
  const [learnedAt, setLearnedAt] = useState<string | null>(null);
  const [srsInfo, setSrsInfo] = useState<{ stage: number; nextReview: string } | null>(null);
  const [customLists, setCustomLists] = useState<CustomList[]>([]);
  const [listPanelOpen, setListPanelOpen] = useState(false);

  useEffect(() => {
    if (!collectionsLoaded) return;
    const found = findWord(collections, wordText);
    setWord(found);
    if (found) {
      setStarred(isStarred(found.word));
      setIsHard(getHardWords().includes(found.word));
      const learned = getLearnedWords().find(l => l.word === found.word);
      setLearnedAt(learned?.learnedAt ?? null);
      const srs = getSRSWords().find(s => s.word === found.word);
      if (srs) setSrsInfo({ stage: srs.reviewStage, nextReview: srs.nextReviewDate });
    }
  }, [collectionsLoaded, collections, wordText]);

  const handleStar = () => {
    if (!word) return;
    setStarred(toggleStarred(word.word));
  };

  const handleHardToggle = () => {
    if (!word) return;
    if (isHard) { removeHardWord(word.word); setIsHard(false); }
    else { addHardWord(word.word); setIsHard(true); }
  };

  const reloadLists = () => setCustomLists(getCustomLists());
  useEffect(() => {
    reloadLists();
    window.addEventListener('lexivo-sync', reloadLists);
    return () => window.removeEventListener('lexivo-sync', reloadLists);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleListToggle = (listId: string) => {
    if (!word) return;
    if (isWordInList(listId, word.word)) removeWordFromList(listId, word.word);
    else addWordToList(listId, word.word);
    reloadLists();
  };

  const handleCreateAndAdd = () => {
    if (!word) return;
    const name = prompt('New list name:');
    if (!name?.trim()) return;
    const list: CustomList = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: name.trim(),
      createdAt: new Date().toISOString(),
      words: [word.word],
    };
    saveCustomList(list);
    reloadLists();
  };

  if (!collectionsLoaded) {
    return <div className="flex items-center justify-center min-h-screen"><div className="text-4xl animate-bounce">📖</div></div>;
  }

  if (!word) {
    return (
      <div className="p-6 text-center">
        <div className="text-5xl mb-4">🔍</div>
        <h2 className="font-bold text-xl mb-2">Word not found</h2>
        <p className="text-[var(--text-muted)] text-sm mb-4">"{wordText}" isn't in any collection.</p>
        <Link href="/search" className="btn-primary inline-block">Search Words</Link>
      </div>
    );
  }

  const enc = encodeURIComponent(word.collectionName);
  const learnUrl  = `/learn?collection=${enc}&day=${word.dayNumber}`;
  const flashUrl  = `/flashcards?collection=${enc}&day=${word.dayNumber}`;
  const unitUrl   = `/collections/${enc}`;

  return (
    <div className="flex flex-col min-h-screen animate-fade-in pb-8">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-lg">←</button>
        <span className="badge">{word.topic}</span>
        <div className="flex gap-2">
          <button
            onClick={handleStar}
            className="w-9 h-9 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-lg"
            title={starred ? 'Unstar' : 'Star'}
          >{starred ? '⭐' : '☆'}</button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Word hero */}
        <div className="card">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex-1">
              <h1 className="text-4xl font-black text-[var(--text)] mb-1">{word.word}</h1>
              <p className="text-sm text-[var(--text-muted)]">
                <span className="italic">{word.partOfSpeech}</span>
                <span className="mx-2">·</span>
                <span>{word.pronunciation}</span>
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => speak(word.word)}
                className="w-10 h-10 rounded-full bg-[var(--primary-bg)] flex items-center justify-center text-lg hover:bg-[var(--primary)] hover:text-white transition-colors"
                title="Normal speed"
              >🔊</button>
              <button
                onClick={() => speak(word.word, 0.6)}
                className="w-10 h-10 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-base hover:bg-[var(--primary-bg)] transition-colors"
                title="Slow"
              >🐌</button>
            </div>
          </div>

          {/* Translation */}
          <div className="bg-[var(--primary-bg)] rounded-2xl p-4">
            <p className="text-xs font-semibold text-[var(--primary)] mb-1">🇺🇿 O'zbek tarjimasi</p>
            <p className="text-2xl font-bold text-[var(--primary)]">{word.translation}</p>
          </div>
        </div>

        {/* Definition */}
        <div className="card">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">📖 Definition</h2>
          <p className="text-[var(--text)] leading-relaxed">{word.definition}</p>
        </div>

        {/* Examples */}
        <div className="card space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">💬 Examples</h2>
          {[
            { text: word.example1, situation: word.example1Situation, translation: null },
            { text: word.example2, situation: word.example2Situation, translation: null },
            { text: word.example3, situation: word.example3Situation, translation: word.example3Translation },
          ].filter(e => e.text).map((ex, i) => (
            <div key={i} className="space-y-1">
              <div className="bg-[var(--surface-2)] rounded-xl p-3">
                <p className="text-xs text-[var(--text-muted)] mb-1">Example {i + 1}</p>
                <p className="text-sm italic text-[var(--text)]">"{ex.text}"</p>
                {ex.translation && (
                  <p className="text-xs text-[var(--primary)] mt-1">{ex.translation}</p>
                )}
              </div>
              {ex.situation && (
                <div className="bg-amber-50 rounded-xl p-3">
                  <p className="text-xs text-amber-600 mb-0.5">🗺️ Holat {i + 1} (O'zbek)</p>
                  <p className="text-xs text-amber-900">{ex.situation}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Status cards row */}
        <div className="grid grid-cols-2 gap-3">
          {/* Learned status */}
          <div className="card py-3 text-center">
            {learnedAt ? (
              <>
                <div className="text-2xl mb-1">✅</div>
                <div className="text-xs font-semibold text-[var(--success)]">Learned</div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">
                  {new Date(learnedAt).toLocaleDateString()}
                </div>
              </>
            ) : (
              <>
                <div className="text-2xl mb-1">📚</div>
                <div className="text-xs font-semibold text-[var(--text-muted)]">Not learned yet</div>
              </>
            )}
          </div>

          {/* SRS status */}
          <div className="card py-3 text-center">
            {srsInfo ? (
              <>
                <div className="text-2xl mb-1">🔄</div>
                <div
                  className="text-xs font-semibold"
                  style={{ color: stageColor(srsInfo.stage) }}
                >{stageLabel(srsInfo.stage)}</div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">
                  Review: {srsInfo.nextReview}
                </div>
              </>
            ) : (
              <>
                <div className="text-2xl mb-1">💤</div>
                <div className="text-xs font-semibold text-[var(--text-muted)]">Not in SRS</div>
              </>
            )}
          </div>
        </div>

        {/* Source */}
        <div className="card flex items-center justify-between">
          <div>
            <p className="text-xs text-[var(--text-muted)]">From collection</p>
            <p className="font-semibold text-sm text-[var(--text)]">{word.collectionName}</p>
            <p className="text-xs text-[var(--text-muted)]">Unit {word.dayNumber} · {word.topic}</p>
          </div>
          <Link href={unitUrl} className="text-[var(--primary)] text-sm font-medium hover:underline">
            View unit →
          </Link>
        </div>

        {/* Hard word toggle */}
        <button
          onClick={handleHardToggle}
          className={`w-full py-3 rounded-xl border-2 text-sm font-semibold transition-colors ${
            isHard
              ? 'border-[var(--danger)] bg-red-50 text-[var(--danger)]'
              : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--danger)] hover:text-[var(--danger)]'
          }`}
        >
          {isHard ? '✓ In hard words list — tap to remove' : '😓 Add to Hard Words'}
        </button>

        {/* Add to list */}
        <div className="rounded-2xl border border-[var(--border)] overflow-hidden">
          <button
            onClick={() => setListPanelOpen(o => !o)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--surface-2)] transition-colors"
          >
            <span className="text-lg">📋</span>
            <span className="font-semibold text-[var(--text)] text-sm flex-1">Add to list</span>
            {customLists.filter(l => isWordInList(l.id, word.word)).length > 0 && (
              <span className="text-xs bg-[var(--primary-bg)] text-[var(--primary)] px-2 py-0.5 rounded-full font-semibold">
                {customLists.filter(l => isWordInList(l.id, word.word)).length}
              </span>
            )}
            <span className="text-xs text-[var(--text-muted)]">{listPanelOpen ? '▲' : '▼'}</span>
          </button>

          {listPanelOpen && (
            <div className="border-t border-[var(--border)] p-3 space-y-2 animate-fade-in">
              {customLists.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] text-center py-1">No lists yet.</p>
              ) : (
                customLists.map(list => {
                  const inList = isWordInList(list.id, word.word);
                  return (
                    <button
                      key={list.id}
                      onClick={() => handleListToggle(list.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                        inList
                          ? 'bg-green-50 border border-[var(--success)]'
                          : 'bg-[var(--surface-2)] hover:bg-[var(--primary-bg)]'
                      }`}
                    >
                      <span className={`text-base flex-shrink-0 ${inList ? 'text-[var(--success)]' : 'text-[var(--text-muted)]'}`}>
                        {inList ? '✓' : '○'}
                      </span>
                      <span className={`flex-1 text-left font-medium truncate ${inList ? 'text-[var(--success)]' : 'text-[var(--text)]'}`}>
                        {list.name}
                      </span>
                      <span className="text-xs text-[var(--text-muted)] flex-shrink-0">
                        {list.words.length} word{list.words.length !== 1 ? 's' : ''}
                      </span>
                    </button>
                  );
                })
              )}
              <button
                onClick={handleCreateAndAdd}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-[var(--primary)] font-semibold hover:bg-[var(--primary-bg)] transition-colors border border-dashed border-[var(--primary)]"
              >
                <span>+</span>
                <span>Create new list & add</span>
              </button>
              <Link
                href="/lists"
                className="block text-center text-xs text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors pt-1"
              >
                Manage all lists →
              </Link>
            </div>
          )}
        </div>

        {/* Practice buttons */}
        <div className="grid grid-cols-3 gap-2">
          <Link href={learnUrl} className="flex flex-col items-center gap-1 py-3 rounded-xl bg-[var(--primary-bg)] text-[var(--primary)] text-xs font-semibold hover:bg-[var(--primary)] hover:text-white transition-colors">
            <span className="text-lg">📖</span>Learn
          </Link>
          <Link href={flashUrl} className="flex flex-col items-center gap-1 py-3 rounded-xl bg-[var(--primary-bg)] text-[var(--primary)] text-xs font-semibold hover:bg-[var(--primary)] hover:text-white transition-colors">
            <span className="text-lg">🃏</span>Cards
          </Link>
        </div>
      </div>
    </div>
  );
}
