'use client';
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { readingPassages, type ReadingPassage } from '@/lib/reading-data';

const CARD_COLORS = [
  ['#6C63FF', '#8B5CF6'],
  ['#0E7490', '#22D3EE'],
  ['#1A9A50', '#2ECC71'],
  ['#B45309', '#FBBF24'],
  ['#BE123C', '#FB7185'],
  ['#EC4899', '#F472B6'],
  ['#0284C7', '#38BDF8'],
  ['#D97706', '#FCD34D'],
];

const allTopics = ['All', ...Array.from(new Set(readingPassages.map(p => p.topic))).sort()];

type Tooltip = { text: string; x: number; y: number };

function PassageView({ passage, onBack }: { passage: ReadingPassage; onBack: () => void }) {
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [collected, setCollected] = useState<string[]>([]);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const [copied, setCopied] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleSelection = useCallback(() => {
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (!text || !sel || sel.rangeCount === 0) { setTooltip(null); return; }
    // Only capture selections inside the passage content
    const range = sel.getRangeAt(0);
    if (!contentRef.current?.contains(range.commonAncestorContainer)) { setTooltip(null); return; }
    const rect = range.getBoundingClientRect();
    setTooltip({ text, x: rect.left + rect.width / 2, y: rect.top + window.scrollY - 8 });
  }, []);

  useEffect(() => {
    document.addEventListener('mouseup', handleSelection);
    document.addEventListener('touchend', handleSelection);
    return () => {
      document.removeEventListener('mouseup', handleSelection);
      document.removeEventListener('touchend', handleSelection);
    };
  }, [handleSelection]);

  const addToCollected = () => {
    if (!tooltip) return;
    const text = tooltip.text;
    setCollected(prev => prev.includes(text) ? prev : [...prev, text]);
    setTooltip(null);
    window.getSelection()?.removeAllRanges();
  };

  const removeCollected = (i: number) => setCollected(prev => prev.filter((_, idx) => idx !== i));

  const copyAll = () => {
    navigator.clipboard.writeText(collected.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const paragraphs = passage.content.split('\n').map(p => p.trim()).filter(Boolean);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-32 relative">
      {/* Floating add tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 -translate-x-1/2 -translate-y-full"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={addToCollected}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full shadow-lg"
            style={{ background: 'var(--primary)', color: 'white' }}
          >
            + Collect
          </button>
          <div className="flex justify-center">
            <div className="w-2 h-2 rotate-45 -mt-1" style={{ background: 'var(--primary)' }} />
          </div>
        </div>
      )}

      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm mb-6"
        style={{ color: 'var(--text-muted)' }}
      >
        ← Back to Library
      </button>

      <span
        className="inline-block text-xs font-bold px-3 py-1 rounded-full mb-4"
        style={{ background: 'var(--primary-bg)', color: 'var(--primary)' }}
      >
        {passage.topic}
      </span>

      <h1 className="text-2xl font-black mb-2" style={{ color: 'var(--text)' }}>
        {passage.title}
      </h1>
      <p className="text-xs mb-6" style={{ color: 'var(--text-muted)' }}>
        Select any word or phrase to collect it
      </p>

      <div ref={contentRef} className="space-y-5 mb-10">
        {paragraphs.map((para, i) => (
          <p key={i} className="text-base leading-[1.85]" style={{ color: 'var(--text)', textAlign: 'justify' }}>
            {para}
          </p>
        ))}
      </div>

      {passage.questions.length > 0 && (
        <>
          <div className="border-t mb-8" style={{ borderColor: 'var(--border)' }} />
          <h2 className="text-lg font-black mb-1" style={{ color: 'var(--text)' }}>
            Comprehension Questions
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            Think about your answer, then reveal the explanation.
          </p>
          <div className="space-y-3">
            {passage.questions.map((q, i) => {
              const isRevealed = revealed.has(i);
              return (
                <div
                  key={i}
                  className="rounded-2xl overflow-hidden border"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
                >
                  <div className="flex gap-3 p-4">
                    <span
                      className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black"
                      style={{ background: 'var(--primary-bg)', color: 'var(--primary)' }}
                    >
                      {i + 1}
                    </span>
                    <p className="text-sm font-semibold leading-relaxed" style={{ color: 'var(--text)' }}>
                      {q.question}
                    </p>
                  </div>
                  {isRevealed && (
                    <div className="flex gap-2 px-4 pb-4" style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                      <span className="text-sm shrink-0">💡</span>
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                        {q.explanation}
                      </p>
                    </div>
                  )}
                  <button
                    onClick={() => {
                      const next = new Set(revealed);
                      if (isRevealed) next.delete(i); else next.add(i);
                      setRevealed(next);
                    }}
                    className="w-full py-3 text-sm font-bold transition-colors"
                    style={{
                      borderTop: '1px solid var(--border)',
                      color: 'var(--primary)',
                      background: isRevealed ? 'var(--surface)' : 'var(--primary-bg)',
                    }}
                  >
                    {isRevealed ? 'Hide explanation' : 'Show explanation'}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Collected words tray — fixed at bottom */}
      {collected.length > 0 && (
        <div
          className="fixed bottom-0 left-0 right-0 z-40 px-4 py-3 border-t"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
                {collected.length} collected
              </span>
              <button
                onClick={copyAll}
                className="text-xs font-bold px-3 py-1.5 rounded-xl transition-all"
                style={{ background: 'var(--primary)', color: 'white' }}
              >
                {copied ? '✓ Copied!' : 'Copy all'}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {collected.map((item, i) => (
                <span
                  key={i}
                  className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: 'var(--primary-bg)', color: 'var(--primary)' }}
                >
                  {item}
                  <button
                    onClick={() => removeCollected(i)}
                    className="opacity-60 hover:opacity-100 ml-0.5"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReadingPage() {
  const [selected, setSelected] = useState<ReadingPassage | null>(null);
  const [search, setSearch] = useState('');
  const [topic, setTopic] = useState('All');

  const filtered = useMemo(() => readingPassages.filter(p => {
    const matchesTopic = topic === 'All' || p.topic === topic;
    const matchesSearch = !search.trim() || p.title.toLowerCase().includes(search.toLowerCase()) || p.topic.toLowerCase().includes(search.toLowerCase());
    return matchesTopic && matchesSearch;
  }), [search, topic]);

  if (selected) {
    return <PassageView passage={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--text)' }}>💡 Ideas</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {filtered.length} of {readingPassages.length} {readingPassages.length === 1 ? 'passage' : 'passages'}
          </p>
        </div>
        <Link
          href="/reading/free"
          className="text-xs font-bold px-3 py-2 rounded-xl border transition-colors"
          style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}
        >
          Free Read →
        </Link>
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search passages…"
        className="w-full px-4 py-2.5 rounded-xl text-sm border outline-none transition-colors mb-3"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
        }}
        onFocus={e => (e.target.style.borderColor = 'var(--primary)')}
        onBlur={e => (e.target.style.borderColor = 'var(--border)')}
      />

      {/* Topic filter — single scrollable row */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5" style={{ scrollbarWidth: 'none' }}>
        {allTopics.map(t => (
          <button
            key={t}
            onClick={() => setTopic(t)}
            className="shrink-0 text-xs font-bold px-3 py-2 rounded-xl transition-all"
            style={{
              background: topic === t ? 'var(--primary)' : 'var(--surface)',
              color: topic === t ? 'white' : 'var(--text-muted)',
              border: `1px solid ${topic === t ? 'var(--primary)' : 'var(--border)'}`,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* 2-column grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-20" style={{ color: 'var(--text-muted)' }}>
          <p className="text-3xl mb-3">🔍</p>
          <p className="text-sm font-semibold">No passages match your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((passage) => {
            const colorIndex = (passage.id - 1) % CARD_COLORS.length;
            const [c1, c2] = CARD_COLORS[colorIndex];
            return (
              <button
                key={passage.id}
                onClick={() => setSelected(passage)}
                className="w-full text-left rounded-2xl px-4 py-3.5 flex items-center gap-3 transition-transform hover:-translate-y-0.5 active:scale-[0.99] animate-heartbeat"
                style={{
                  background: `linear-gradient(135deg, ${c1}, ${c2})`,
                  boxShadow: `0 5px 0 ${c1}99, 0 8px 20px ${c1}44`,
                }}
              >
                <span
                  className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black text-white"
                  style={{ background: 'rgba(255,255,255,0.2)' }}
                >
                  {passage.id}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-white text-sm leading-tight truncate">{passage.title}</p>
                  <p className="text-xs mt-0.5 font-semibold truncate" style={{ color: 'rgba(255,255,255,0.75)' }}>
                    {passage.topic}
                  </p>
                </div>
                {passage.questions.length > 0 && (
                  <span
                    className="shrink-0 text-xs font-bold px-2 py-1 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}
                  >
                    {passage.questions.length} Q
                  </span>
                )}
                <span className="text-white/50 text-sm">›</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
