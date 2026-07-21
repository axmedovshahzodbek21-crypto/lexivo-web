'use client';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { useShallow } from 'zustand/react/shallow';
import { getImportedWords } from '@/lib/storage';
import { useEffect, useState } from 'react';
import TiltCard from '@/components/TiltCard';

const COLLECTION_META: Record<string, { icon: string; color: string; desc: string }> = {
  '30 Days of Powerful Words': { icon: '🏆', color: 'var(--primary)', desc: 'Essential IELTS vocabulary by topic' },
  '24 Vocabulary Challenge':   { icon: '💡', color: '#FF6584', desc: 'Idioms and phrases for fluent speakers' },
  'Word Mastery':              { icon: '🎯', color: '#2ECC71', desc: 'High-level C1 & B2 collocations' },
};

const LEVELED_NAMES = new Set(['A1', 'A2', 'B1', 'Advanced']);

export default function CollectionsPage() {
  const { collections } = useAppStore(useShallow(s => ({ collections: s.collections })));
  const [importedCount, setImportedCount] = useState(0);

  useEffect(() => {
    setImportedCount(getImportedWords().length);
  }, []);

  const mainCollections = collections.filter(c => !LEVELED_NAMES.has(c.name));

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4 pb-24">
      <h1 className="text-2xl font-bold text-[var(--text)]">Collections</h1>

      {/* My Words */}
      <TiltCard className="card overflow-hidden hover:border-[var(--primary)] transition-colors" intensity={6}>
        <Link href="/my-words" className="flex items-center gap-4" style={{ margin: '-20px', padding: '20px' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 animate-float-icon" style={{ background: 'rgba(108,99,255,0.12)' }}>
            ✍️
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-[var(--text)] text-sm">My Words</div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">Your personal word list</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">
              {importedCount > 0 ? `${importedCount} words` : 'Add your first word'}
            </div>
          </div>
          <span className="flex-shrink-0 text-sm font-semibold" style={{ color: 'var(--primary)' }}>
            {importedCount > 0 ? '→' : '+'}
          </span>
        </Link>
      </TiltCard>

      {/* Curated collections */}
      {mainCollections.map(col => {
        const meta = COLLECTION_META[col.name] ?? { icon: '📖', color: 'var(--primary)', desc: col.description };
        const enc = encodeURIComponent(col.name);
        const wordCount = col.days.reduce((a, d) => a + d.words.length, 0);
        return (
          <TiltCard
            key={col.name}
            className="card overflow-hidden hover:border-[var(--primary)] transition-colors"
            style={{ boxShadow: `0 4px 14px ${meta.color}22` }}
            intensity={6}
          >
            <Link href={`/collections/${enc}`} className="flex items-center gap-4" style={{ margin: '-20px', padding: '20px' }}>
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 animate-float-icon"
                style={{ background: `${meta.color}18` }}
              >
                {meta.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[var(--text)] text-sm truncate">{col.name}</div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{meta.desc}</div>
                <div className="text-xs text-[var(--text-muted)] mt-1">{col.days.length} units · {wordCount} words</div>
              </div>
              <span className="flex-shrink-0 text-sm font-semibold" style={{ color: meta.color }}>→</span>
            </Link>
          </TiltCard>
        );
      })}

      {/* Leveled Words */}
      <TiltCard
        className="overflow-hidden rounded-2xl border-2 cursor-pointer"
        style={{ background: 'rgba(46,204,113,0.06)', borderColor: 'rgba(46,204,113,0.35)' }}
        intensity={5}
      >
        <Link href="/leveled-words" className="flex items-center gap-4 p-4 block">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 animate-float-icon" style={{ background: 'rgba(46,204,113,0.12)' }}>
            📚
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm" style={{ color: '#27AE60' }}>Leveled Words</div>
            <div className="text-xs mt-0.5" style={{ color: '#2ECC71' }}>A1 → C2 vocabulary by CEFR level</div>
          </div>
          <span className="text-sm flex-shrink-0" style={{ color: '#2ECC71' }}>→</span>
        </Link>
      </TiltCard>
    </div>
  );
}
