'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import BackButton from '@/components/BackButton';
import { DEBATE_TOPICS, type DebateTopic } from '@/lib/debateMock';
import { getBRSideContent } from '@/lib/battleReadyContent';
import { getDoneTopics } from '@/lib/battleReadyDone';
import { pickRandom, playShuffleTick, playShuffleReveal } from '@/lib/shuffle';

const SURPRISE_TICKS = 9;

export default function BattleReadyHubPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [doneSet, setDoneSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    setDoneSet(getDoneTopics());
  }, []);

  const withContent = useMemo(
    () => DEBATE_TOPICS.filter(t => getBRSideContent(t.slug, 'for') || getBRSideContent(t.slug, 'against')),
    []
  );

  const filtered = useMemo(
    () => DEBATE_TOPICS.filter(t => t.title.toLowerCase().includes(search.toLowerCase())),
    [search]
  );

  // ── Surprise Me ──────────────────────────────────────────────────────────
  const [surpriseShuffling, setSurpriseShuffling] = useState(false);
  const [surpriseShown, setSurpriseShown] = useState<DebateTopic | null>(null);
  const surpriseLastIndexRef = useRef<number | undefined>(undefined);
  const surpriseTimeoutRef = useRef<number | null>(null);
  const surpriseCancelledRef = useRef(false);

  useEffect(() => {
    return () => {
      surpriseCancelledRef.current = true;
      if (surpriseTimeoutRef.current !== null) window.clearTimeout(surpriseTimeoutRef.current);
    };
  }, []);

  const surpriseMe = () => {
    if (surpriseShuffling) return;
    const notDone = withContent.filter(t => !doneSet.has(t.slug));
    const pool = notDone.length > 0 ? notDone : withContent;
    if (pool.length === 0) return;

    surpriseCancelledRef.current = false;
    setSurpriseShuffling(true);
    const { item: finalTopic, index: finalIndex } = pickRandom(pool, surpriseLastIndexRef.current);
    surpriseLastIndexRef.current = finalIndex;

    let tick = 0;
    const runTick = () => {
      if (surpriseCancelledRef.current) return;
      tick += 1;
      const isLast = tick >= SURPRISE_TICKS;
      const progress = tick / SURPRISE_TICKS;
      const shown = isLast ? finalTopic : pickRandom(pool).item;
      setSurpriseShown(shown);

      if (isLast) {
        playShuffleReveal();
        surpriseTimeoutRef.current = window.setTimeout(() => {
          if (surpriseCancelledRef.current) return;
          setSurpriseShuffling(false);
          setSurpriseShown(null);
          router.push(`/battle-ready/${finalTopic.slug}`);
        }, 260);
        return;
      }

      playShuffleTick(1 + progress * 0.5);
      const delay = 70 + progress * progress * 260;
      surpriseTimeoutRef.current = window.setTimeout(runTick, delay);
    };
    runTick();
  };

  return (
    <div className="p-4 space-y-6 animate-fade-in max-w-3xl mx-auto">
      {surpriseShuffling && surpriseShown && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
        >
          <div className="w-full max-w-xs flex flex-col items-center gap-4">
            <p className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <span className="inline-block animate-spin" style={{ animationDuration: '0.9s' }}>🎲</span>
              Finding a topic for you…
            </p>
            <div className="w-full rounded-2xl p-8 text-center bg-white/10 border border-white/20">
              <div className="text-4xl mb-2">{surpriseShown.emoji}</div>
              <div className="font-bold text-white">{surpriseShown.title}</div>
            </div>
          </div>
        </div>
      )}

      <BackButton href="/" />

      <div className="flex items-center gap-3">
        <span className="text-3xl">🛡️</span>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[var(--text)]">Battle-Ready</h1>
          <p className="text-sm text-[var(--text-muted)]">{withContent.length}/{DEBATE_TOPICS.length} topics filled in</p>
        </div>
        <button
          onClick={surpriseMe}
          disabled={surpriseShuffling || withContent.length === 0}
          className="text-xs font-bold px-3.5 py-2 rounded-xl text-white shrink-0 disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #a78bfa, #6C63FF, #4C1D95)', boxShadow: '0 3px 0 #3D1F9E, 0 6px 14px rgba(108,99,255,0.35)' }}
        >
          🎲 Surprise Me
        </button>
      </div>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search topics..."
        className="w-full rounded-xl px-3 py-2 text-sm bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] outline-none focus:border-[#818cf8]"
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {filtered.map(t => {
          const hasContent = !!getBRSideContent(t.slug, 'for') || !!getBRSideContent(t.slug, 'against');
          const done = doneSet.has(t.slug);
          return (
            <Link
              key={t.slug}
              href={`/battle-ready/${t.slug}`}
              className="relative rounded-2xl p-3 border border-[var(--border)] bg-[var(--surface)] hover:-translate-y-0.5 transition-transform flex flex-col items-center text-center gap-1.5"
            >
              {done ? (
                <span className="absolute top-2 right-2 text-xs" title="Done">✅</span>
              ) : hasContent ? (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-green-500" title="Has content" />
              ) : null}
              <span className="text-2xl">{t.emoji}</span>
              <div className="font-semibold text-xs text-[var(--text)] leading-tight">{t.title}</div>
            </Link>
          );
        })}
        {filtered.length === 0 && (
          <p className="col-span-full text-sm text-[var(--text-muted)] text-center py-8">No topics match your search.</p>
        )}
      </div>
    </div>
  );
}
