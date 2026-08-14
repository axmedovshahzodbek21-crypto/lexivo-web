'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import { searchWords } from '@/lib/data';
import { speak } from '@/lib/speech';
import { toggleStarred, isStarred } from '@/lib/storage';
import { pushLists } from '@/lib/sync';
import Link from 'next/link';
import type { WordItem } from '@/lib/types';
import { useTranslation } from '@/lib/useTranslation';

interface SearchResult extends WordItem {
  collectionName: string;
  topic: string;
}

const WORD_COLORS = [
  { color: '#8B5CF6', light: '#A78BFA', dark: '#6D28D9' },
  { color: '#06B6D4', light: '#22D3EE', dark: '#0891B2' },
  { color: '#10B981', light: '#34D399', dark: '#059669' },
  { color: '#F59E0B', light: '#FCD34D', dark: '#B45309' },
  { color: '#EF4444', light: '#F87171', dark: '#B91C1C' },
  { color: '#EC4899', light: '#F472B6', dark: '#BE185D' },
  { color: '#3B82F6', light: '#60A5FA', dark: '#1D4ED8' },
  { color: '#F97316', light: '#FB923C', dark: '#C2410C' },
];

export default function SearchPage() {
  const t = useTranslation();
  const { collections } = useAppStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [starredMap, setStarredMap] = useState<Record<string, boolean>>({});
  const [seed, setSeed] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Discovery words — random sample, reshuffled on seed
  const discoveryWords = useMemo(() => {
    if (collections.length === 0) return [];
    const all: SearchResult[] = [];
    collections.forEach(col => {
      col.days.forEach(day => {
        day.words.forEach(w => all.push({ ...w, collectionName: col.name, topic: day.topic ?? col.name }));
      });
    });
    const base = seed * 7919;
    return [...all]
      .sort((a, b) => ((a.word.charCodeAt(0) * 31 + base) % 97) - ((b.word.charCodeAt(0) * 31 + base) % 97))
      .slice(0, 24);
  }, [collections, seed]);

  useEffect(() => {
    if (query.length < 1) { setResults([]); return; }
    const found = searchWords(collections, query);
    setResults(found);
    const map: Record<string, boolean> = {};
    found.forEach(r => { map[r.word] = isStarred(r.word); });
    setStarredMap(map);
  }, [query, collections]);

  const handleStar = (word: string) => {
    setStarredMap(m => ({ ...m, [word]: toggleStarred(word) }));
    pushLists();
  };

  const toggleExpanded = (key: string) => setExpanded(e => e === key ? null : key);

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 16px 96px' }}>

      {/* Editorial header */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 11, fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 6 }}>
          Vocabulary · 2,500+ words
        </p>
        <h1 style={{ fontSize: 40, fontWeight: 900, color: 'var(--text)', lineHeight: 1 }}>Search</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
          Find any word across all your collections.
        </p>
      </div>

      {/* Search bar */}
      <div style={{ position: 'relative', marginBottom: 28 }}>
        <span style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', fontSize: 18, pointerEvents: 'none' }}>
          🔍
        </span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t.search.placeholder}
          style={{
            width: '100%',
            paddingLeft: 52, paddingRight: query ? 48 : 20,
            paddingTop: 16, paddingBottom: 16,
            fontSize: 16, fontWeight: 500,
            borderRadius: 18,
            border: '2px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text)',
            outline: 'none',
            transition: 'border-color 0.2s, box-shadow 0.2s',
            boxSizing: 'border-box',
          }}
          onFocus={e => {
            e.target.style.borderColor = '#8B5CF6';
            e.target.style.boxShadow = '0 0 0 4px #8B5CF625, 0 4px 24px #8B5CF618';
          }}
          onBlur={e => {
            e.target.style.borderColor = 'var(--border)';
            e.target.style.boxShadow = 'none';
          }}
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            style={{ position: 'absolute', right: 18, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16 }}
          >✕</button>
        )}
      </div>

      {/* ── Search results ── */}
      {query.length > 0 && (
        <>
          {results.length > 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
              {t.search.results(results.length)}
            </p>
          )}

          {results.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <p style={{ fontSize: 40, marginBottom: 12 }}>😕</p>
              <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{t.search.noResults(query)}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {results.map((result, i) => {
                const { color } = WORD_COLORS[i % WORD_COLORS.length];
                const key = `${result.collectionName}-${result.word}`;
                const isExpanded = expanded === key;
                return (
                  <div
                    key={key}
                    onClick={() => toggleExpanded(key)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpanded(key); } }}
                    style={{
                      background: 'var(--surface)',
                      border: '1.5px solid var(--border)',
                      borderLeft: `4px solid ${color}`,
                      borderRadius: 16,
                      padding: '14px 16px',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, justifyContent: 'space-between' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
                          <span style={{ fontSize: 17, fontWeight: 900, color: 'var(--text)' }}>{result.word}</span>
                          {result.partOfSpeech && (
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>{result.partOfSpeech}</span>
                          )}
                        </div>
                        <p style={{ fontSize: 13, fontWeight: 700, color, marginBottom: 3 }}>{result.translation}</p>
                        {!isExpanded && (
                          <p style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {result.definition}
                          </p>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button
                          onClick={e => { e.stopPropagation(); speak(result.word); }}
                          style={{ width: 32, height: 32, borderRadius: '50%', background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, border: 'none', cursor: 'pointer' }}
                        >🔊</button>
                        <button
                          onClick={e => { e.stopPropagation(); handleStar(result.word); }}
                          style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, border: 'none', cursor: 'pointer' }}
                        >{starredMap[result.word] ? '⭐' : '☆'}</button>
                        <Link
                          href={`/word/${encodeURIComponent(result.word)}`}
                          onClick={e => e.stopPropagation()}
                          style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, textDecoration: 'none', color: 'var(--text-muted)' }}
                        >→</Link>
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                        <p style={{ fontSize: 13, color: 'var(--text)', marginBottom: 8 }}>{result.definition}</p>
                        {result.pronunciation && (
                          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>{result.pronunciation}</p>
                        )}
                        {result.example1 && (
                          <div style={{ background: `${color}12`, borderRadius: 10, padding: '10px 12px', marginBottom: 6 }}>
                            <p style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--text-muted)' }}>"{result.example1}"</p>
                          </div>
                        )}
                        {result.example1Situation && (
                          <div style={{ background: '#FEF3C720', borderRadius: 10, padding: '10px 12px' }}>
                            <p style={{ fontSize: 10, color: '#D97706', marginBottom: 4, fontWeight: 700 }}>🗺️ Holat (Uzbek)</p>
                            <p style={{ fontSize: 12, color: '#92400E' }}>{result.example1Situation}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Discovery grid — empty state ── */}
      {query.length === 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 900, color: 'var(--text)' }}>Discover</p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Random words from your collections</p>
            </div>
            <button
              onClick={() => setSeed(s => s + 1)}
              style={{
                fontSize: 12, fontWeight: 700,
                padding: '7px 16px', borderRadius: 12,
                background: 'linear-gradient(135deg, #A78BFA, #8B5CF6, #6D28D9)',
                boxShadow: '0 3px 0 #6D28D9, 0 6px 14px #8B5CF655',
                color: '#fff', border: 'none', cursor: 'pointer',
                transition: 'transform 0.1s',
              }}
            >
              Shuffle ↻
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {discoveryWords.map((w, i) => {
              const { color, light, dark } = WORD_COLORS[i % WORD_COLORS.length];
              return (
                <Link
                  key={`disc-${i}-${w.word}`}
                  href={`/word/${encodeURIComponent(w.word)}`}
                  style={{
                    position: 'relative',
                    overflow: 'hidden',
                    borderRadius: 16,
                    background: `linear-gradient(135deg, ${light}, ${color}, ${dark})`,
                    boxShadow: `0 3px 0 ${dark}, 0 6px 16px ${color}44`,
                    padding: '14px 12px',
                    minHeight: 88,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    textDecoration: 'none',
                    transition: 'transform 0.15s ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
                >
                  {/* Watermark letter */}
                  <div style={{
                    position: 'absolute', right: 4, bottom: -6,
                    fontSize: 52, fontWeight: 900,
                    color: 'rgba(255,255,255,0.08)',
                    lineHeight: 1, userSelect: 'none', pointerEvents: 'none',
                  }}>{w.word[0]?.toUpperCase()}</div>

                  <p style={{ fontSize: 14, fontWeight: 900, color: '#fff', lineHeight: 1.2 }}>
                    {w.word}
                  </p>
                  <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginTop: 6 }}>
                    {w.translation}
                  </p>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
