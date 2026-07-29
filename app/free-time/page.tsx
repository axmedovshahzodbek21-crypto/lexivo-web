'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { getSRSWords, getReviewLog } from '@/lib/storage';
import { speak } from '@/lib/speech';
import { getWordOfDay } from '@/lib/data';
import { SRS_INTERVALS } from '@/lib/types';
import type { SRSWord, WordItem } from '@/lib/types';

const MAIN_COLLECTIONS = [
  { slug: '30 Days of Powerful Words', icon: '🏆', color: '#6C63FF', desc: 'IELTS vocabulary' },
  { slug: '24 Vocabulary Challenge',   icon: '💡', color: '#FF6584', desc: 'Idioms & phrases' },
  { slug: 'Word Mastery',              icon: '🎯', color: '#2ECC71', desc: 'C1 & B2 collocations' },
];

export default function FreeTimePage() {
  const router = useRouter();
  const { collections, collectionsLoaded } = useAppStore();
  const [wod, setWod] = useState<WordItem | null>(null);
  const [masteredWords, setMasteredWords] = useState<SRSWord[]>([]);
  const [wodRevealed, setWodRevealed] = useState(false);

  useEffect(() => {
    if (collectionsLoaded && collections.length > 0) {
      setWod(getWordOfDay(collections));
    }
  }, [collectionsLoaded, collections]);

  useEffect(() => {
    const allSRS = getSRSWords();
    const log = getReviewLog();
    const threshold = SRS_INTERVALS.length;
    setMasteredWords(allSRS.filter(w => (log[w.id] ?? []).length >= threshold));
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-[var(--border)]">
        <button onClick={() => router.back()} className="btn-icon text-lg" aria-label="Go back">←</button>
        <h1 className="font-bold text-[var(--text)]">Free Time</h1>
      </div>

      <div className="p-4 space-y-5 max-w-lg mx-auto w-full">

        {/* All caught up banner */}
        <div
          className="rounded-3xl p-5"
          style={{ background: 'linear-gradient(135deg, #0F3460, #16213E)', boxShadow: '0 4px 0 #091a2e' }}
        >
          <p className="text-xl font-black text-white">🎉 You&apos;re all caught up!</p>
          <p className="text-sm text-white/60 mt-1">No reviews due. Explore something fun while you wait.</p>
        </div>

        {/* Word of the Day */}
        {wod && (
          <div>
            <h2 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">✨ Word of the Day</h2>
            <div
              className="rounded-2xl p-5"
              style={{ background: 'linear-gradient(135deg, #1A1A2E, #16213E)' }}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-2xl font-black text-white">{wod.word}</p>
                  <p className="text-xs text-white/50 mt-0.5">{wod.partOfSpeech} · {wod.pronunciation}</p>
                  <p className="text-base font-semibold mt-1" style={{ color: '#8B83FF' }}>{wod.translation}</p>
                </div>
                <button
                  onClick={() => speak(wod.word)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0"
                  style={{ background: 'rgba(108,99,255,0.3)', color: '#fff' }}
                  aria-label="Pronounce"
                >🔊</button>
              </div>
              {wodRevealed ? (
                <>
                  <p className="text-sm text-white/80 leading-relaxed mb-3">{wod.definition}</p>
                  {wod.example1 && (
                    <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.07)' }}>
                      <p className="text-[10px] text-white/40 font-semibold mb-1">💬 Example</p>
                      <p className="text-sm text-white leading-relaxed">{wod.example1}</p>
                    </div>
                  )}
                </>
              ) : (
                <button
                  onClick={() => setWodRevealed(true)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }}
                >
                  Show definition
                </button>
              )}
            </div>
          </div>
        )}

        {/* Browse Collections */}
        <div>
          <h2 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">🗂 Browse Collections</h2>
          <p className="text-xs text-[var(--text-muted)] mb-3">Explore words freely — no limits, no pressure.</p>
          <div className="space-y-2">
            {MAIN_COLLECTIONS.map(col => (
              <Link
                key={col.slug}
                href={`/collections/${encodeURIComponent(col.slug)}`}
                className="flex items-center gap-3 p-4 rounded-2xl border transition-opacity hover:opacity-90"
                style={{ background: 'var(--surface)', borderColor: `${col.color}30` }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0"
                  style={{ background: `${col.color}18` }}
                >
                  {col.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[var(--text)]">{col.slug}</p>
                  <p className="text-xs text-[var(--text-muted)]">{col.desc}</p>
                </div>
                <span className="text-sm font-bold shrink-0" style={{ color: col.color }}>→</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Mastered Words */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-wider">⭐ Mastered Words</h2>
            {masteredWords.length > 0 && (
              <span className="text-xs text-[var(--text-muted)]">{masteredWords.length} words</span>
            )}
          </div>
          {masteredWords.length === 0 ? (
            <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ background: 'var(--surface-2)' }}>
              <span className="text-2xl">⭐</span>
              <p className="text-sm text-[var(--text-muted)]">
                No mastered words yet. Complete 5 review stages to master a word!
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {masteredWords.slice(0, 10).map(w => (
                <div
                  key={w.id}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0"
                    style={{ background: 'var(--surface-2)' }}
                  >⭐</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-[var(--text)]">{w.word}</p>
                    <p className="text-xs text-[var(--text-muted)]">{w.translation}</p>
                  </div>
                  <button
                    onClick={() => speak(w.word)}
                    className="text-[var(--primary)] text-lg"
                    aria-label="Pronounce"
                  >🔊</button>
                </div>
              ))}
              {masteredWords.length > 10 && (
                <p className="text-center text-xs text-[var(--text-muted)] pt-1">
                  + {masteredWords.length - 10} more mastered words
                </p>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
