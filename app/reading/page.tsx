'use client';
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import BackButton from '@/components/BackButton';
import { readingPassages, type ReadingPassage } from '@/lib/reading-data';

const CARD_COLORS = [
  { color: '#6366F1', light: '#818CF8', dark: '#4338CA' },
  { color: '#06B6D4', light: '#22D3EE', dark: '#0891B2' },
  { color: '#10B981', light: '#34D399', dark: '#059669' },
  { color: '#F59E0B', light: '#FCD34D', dark: '#B45309' },
  { color: '#EF4444', light: '#F87171', dark: '#B91C1C' },
  { color: '#EC4899', light: '#F472B6', dark: '#BE185D' },
  { color: '#3B82F6', light: '#60A5FA', dark: '#1D4ED8' },
  { color: '#F97316', light: '#FB923C', dark: '#C2410C' },
];

const allTopics = ['All', ...Array.from(new Set(readingPassages.map(p => p.topic))).sort()];

type Tooltip = { text: string; x: number; y: number };

const storageKey = (id: number) => `lexivo_collected_${id}`;

function PassageView({ passage, onBack }: { passage: ReadingPassage; onBack: () => void }) {
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [collected, setCollected] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey(passage.id)) ?? '[]'); }
    catch { return []; }
  });
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const [copied, setCopied] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(storageKey(passage.id), JSON.stringify(collected));
  }, [collected, passage.id]);

  const handleSelection = useCallback(() => {
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (!text || !sel || sel.rangeCount === 0) { setTooltip(null); return; }
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

      <BackButton label="Back to Library" className="mb-6" />

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
    return <PassageView passage={selected} onBack={() => { setSelected(null); window.scrollTo(0, 0); }} />;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pb-24">
      {/* Editorial header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <p style={{ fontSize: 11, fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 6 }}>
            Explore · {readingPassages.length} passages
          </p>
          <h1 style={{ fontSize: 40, fontWeight: 900, color: 'var(--text)', lineHeight: 1 }}>Ideas</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
            Read, collect vocabulary, and answer comprehension questions.
          </p>
        </div>
        <Link
          href="/reading/free"
          style={{
            fontSize: 12, fontWeight: 700,
            padding: '8px 16px', borderRadius: 12,
            border: '1.5px solid var(--border)',
            color: 'var(--text-muted)',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
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
        className="w-full px-4 py-3 rounded-2xl text-sm outline-none transition-all mb-4"
        style={{
          background: 'var(--surface)',
          border: '1.5px solid var(--border)',
          color: 'var(--text)',
          fontSize: 14,
        }}
        onFocus={e => (e.target.style.borderColor = 'var(--primary)')}
        onBlur={e => (e.target.style.borderColor = 'var(--border)')}
      />

      {/* Topic filter — scrollable row with gradient active pill */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-6" style={{ scrollbarWidth: 'none' }}>
        {allTopics.map(t => {
          const active = topic === t;
          return (
            <button
              key={t}
              onClick={() => setTopic(t)}
              className="shrink-0 text-xs font-bold px-3 py-2 rounded-xl transition-all duration-200"
              style={active ? {
                background: 'linear-gradient(135deg, #FDE047, #EAB308, #A16207)',
                boxShadow: '0 3px 0 #A16207, 0 6px 14px #EAB30860',
                color: '#fff',
                border: '1px solid transparent',
              } : {
                background: 'var(--surface)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border)',
              }}
            >
              {t}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-20" style={{ color: 'var(--text-muted)' }}>
          <p className="text-3xl mb-3">🔍</p>
          <p className="text-sm font-semibold">No passages match your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((passage) => {
            const { color, light, dark } = CARD_COLORS[(passage.id - 1) % CARD_COLORS.length];
            const numStr = String(passage.id).padStart(2, '0');
            return (
              <button
                key={passage.id}
                onClick={() => { setSelected(passage); window.scrollTo(0, 0); }}
                className="w-full text-left transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: 20,
                  background: `linear-gradient(135deg, ${light}, ${color}, ${dark})`,
                  boxShadow: `0 4px 0 ${dark}, 0 8px 20px ${color}55`,
                  padding: '16px 14px',
                  minHeight: 130,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                {/* Watermark number */}
                <div style={{
                  position: 'absolute', right: 6, top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: 72, fontWeight: 900,
                  color: 'rgba(255,255,255,0.07)',
                  lineHeight: 1,
                  userSelect: 'none', pointerEvents: 'none',
                }}>{numStr}</div>

                {/* Topic label */}
                <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {passage.topic}
                </p>

                {/* Title + badge row */}
                <div>
                  <p style={{
                    fontSize: 13, fontWeight: 900, color: '#fff',
                    lineHeight: 1.3, marginBottom: 8,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    textShadow: '0 1px 4px rgba(0,0,0,0.3)',
                  }}>
                    {passage.title}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {passage.questions.length > 0 ? (
                      <span style={{
                        fontSize: 10, fontWeight: 700,
                        color: 'rgba(255,255,255,0.9)',
                        background: 'rgba(0,0,0,0.22)',
                        borderRadius: 6, padding: '2px 8px',
                      }}>
                        {passage.questions.length} Q
                      </span>
                    ) : <span />}
                    <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>›</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
