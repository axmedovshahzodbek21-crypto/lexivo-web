'use client';
import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { notFound } from 'next/navigation';
import BackButton from '@/components/BackButton';
import { getBRSideContent, type BRSide } from '@/lib/battleReadyContent';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function VocabMatchPage() {
  const params = useParams();
  const slug = String(params.topic);
  const side = String(params.side) as BRSide;
  const content = getBRSideContent(slug, side);
  if (!content) notFound();

  const terms = useMemo(() => shuffle(content.vocab.map(v => v.term)), [content]);
  const defs = useMemo(() => shuffle(content.vocab.map(v => v.definition)), [content]);

  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [wrongPair, setWrongPair] = useState<string | null>(null);
  const sideColor = side === 'for' ? '#22c55e' : '#ef4444';

  function pickTerm(term: string) {
    if (matched.has(term)) return;
    setSelectedTerm(term);
    setWrongPair(null);
  }

  function pickDef(def: string) {
    if (!selectedTerm) return;
    const correct = content!.vocab.find(v => v.term === selectedTerm)?.definition === def;
    if (correct) {
      setMatched(prev => new Set(prev).add(selectedTerm));
      setSelectedTerm(null);
    } else {
      setWrongPair(def);
      setTimeout(() => setWrongPair(null), 500);
    }
  }

  const done = matched.size === content.vocab.length;

  return (
    <div className="p-4 space-y-5 animate-fade-in max-w-xl mx-auto">
      <BackButton href={`/battle-ready/${slug}/${side}/vocabulary`} label="Vocabulary" />
      <h1 className="text-lg font-bold text-[var(--text)]">Match</h1>
      <p className="text-xs text-[var(--text-muted)]">Tap a word, then tap its matching meaning.</p>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          {terms.map(term => {
            const isMatched = matched.has(term);
            const isSelected = selectedTerm === term;
            return (
              <button
                key={term}
                onClick={() => pickTerm(term)}
                disabled={isMatched}
                className="w-full text-left rounded-xl px-3 py-2.5 text-sm border font-semibold"
                style={{
                  borderColor: isMatched ? '#22c55e' : isSelected ? sideColor : 'var(--border)',
                  background: isMatched ? 'rgba(34,197,94,0.1)' : isSelected ? `${sideColor}22` : 'var(--surface)',
                  color: isMatched ? '#15803d' : 'var(--text)',
                  opacity: isMatched ? 0.6 : 1,
                }}
              >
                {term} {isMatched && '✓'}
              </button>
            );
          })}
        </div>
        <div className="space-y-2">
          {defs.map(def => {
            const isMatched = content!.vocab.some(v => v.definition === def && matched.has(v.term));
            const isWrong = wrongPair === def;
            return (
              <button
                key={def}
                onClick={() => pickDef(def)}
                disabled={isMatched}
                className="w-full text-left rounded-xl px-3 py-2.5 text-xs border"
                style={{
                  borderColor: isMatched ? '#22c55e' : isWrong ? '#ef4444' : 'var(--border)',
                  background: isMatched ? 'rgba(34,197,94,0.1)' : isWrong ? 'rgba(239,68,68,0.08)' : 'var(--surface-2)',
                  color: isMatched ? '#15803d' : 'var(--text)',
                  opacity: isMatched ? 0.6 : 1,
                }}
              >
                {def} {isMatched && '✓'}
              </button>
            );
          })}
        </div>
      </div>

      {done && <p className="text-center text-sm font-bold" style={{ color: sideColor }}>All matched! 🎉</p>}
    </div>
  );
}
