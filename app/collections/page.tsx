'use client';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { useShallow } from 'zustand/react/shallow';
import { getImportedWords } from '@/lib/storage';
import { useEffect, useState } from 'react';

const COLLECTION_META: Record<string, { icon: string; gradient: string; edge: string; glow: string; desc: string }> = {
  '30 Days of Powerful Words': {
    icon: '🏆',
    gradient: 'linear-gradient(135deg, #6c63ff 0%, #9b8fff 100%)',
    edge: '#3f38cc',
    glow: 'rgba(108,99,255,0.45)',
    desc: 'Essential IELTS vocabulary by topic',
  },
  '24 Vocabulary Challenge': {
    icon: '💡',
    gradient: 'linear-gradient(135deg, #FF6584 0%, #ff9eb5 100%)',
    edge: '#cc3355',
    glow: 'rgba(255,101,132,0.45)',
    desc: 'Idioms and phrases for fluent speakers',
  },
  'Word Mastery': {
    icon: '🎯',
    gradient: 'linear-gradient(135deg, #1a9a50 0%, #2ECC71 100%)',
    edge: '#0f6634',
    glow: 'rgba(46,204,113,0.45)',
    desc: 'High-level C1 & B2 collocations',
  },
};

const LEVELED_NAMES = new Set(['A1', 'A2', 'B1', 'Advanced']);

function CollectionCard({
  href, icon, title, desc, meta, wordCount, units,
}: {
  href: string; icon: string; title: string; desc: string;
  meta: { gradient: string; edge: string; glow: string };
  wordCount?: number; units?: number;
}) {
  return (
    <Link href={href} className="block group">
      <div
        className="rounded-3xl p-5 flex flex-col items-center text-center gap-3 transition-all duration-200 group-hover:-translate-y-2"
        style={{
          background: meta.gradient,
          boxShadow: `0 10px 0 ${meta.edge}, 0 16px 40px ${meta.glow}`,
        }}
      >
        <div className="text-5xl" style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.35))' }}>{icon}</div>
        <div style={{ textShadow: '0 1px 4px rgba(0,0,0,0.45)' }}>
          <div className="font-black text-white text-lg leading-tight">{title}</div>
          <div className="text-white/90 text-sm mt-1 leading-snug">{desc}</div>
          {(units !== undefined && wordCount !== undefined) && (
            <div className="mt-2 inline-block text-xs font-bold text-white bg-black/25 rounded-full px-3 py-1">
              {units} units · {wordCount} words
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function CollectionsPage() {
  const { collections } = useAppStore(useShallow(s => ({ collections: s.collections })));
  const [importedCount, setImportedCount] = useState(0);

  useEffect(() => {
    setImportedCount(getImportedWords().length);
  }, []);

  const CURATED_ORDER = ['30 Days of Powerful Words', '24 Vocabulary Challenge', 'Word Mastery'];
  const mainCollections = collections
    .filter(c => !LEVELED_NAMES.has(c.name))
    .sort((a, b) => {
      const ai = CURATED_ORDER.indexOf(a.name);
      const bi = CURATED_ORDER.indexOf(b.name);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });

  return (
    <div className="px-6 py-8 pb-28">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors mb-6">
        ← Back
      </Link>
      <h1 className="text-3xl font-black text-[var(--text)] mb-8">Collections</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {/* 1. Leveled Words — best starting point */}
        <CollectionCard
          href="/leveled-words"
          icon="📚"
          title="Leveled Words"
          desc="A1 → C2 vocabulary by CEFR level"
          meta={{ gradient: 'linear-gradient(135deg, #1fa85c 0%, #2ECC71 100%)', edge: '#136e3c', glow: 'rgba(46,204,113,0.45)' }}
        />

        {/* 2-4. Curated collections in progression order */}
        {mainCollections.map(col => {
          const meta = COLLECTION_META[col.name] ?? {
            icon: '📖',
            gradient: 'linear-gradient(135deg, #6c63ff, #8b5cf6)',
            edge: '#3f38cc',
            glow: 'rgba(108,99,255,0.4)',
            desc: col.description ?? '',
          };
          const wc = col.days.reduce((a, d) => a + d.words.length, 0);
          return (
            <CollectionCard
              key={col.name}
              href={`/collections/${encodeURIComponent(col.name)}`}
              icon={meta.icon}
              title={col.name}
              desc={meta.desc}
              meta={meta}
              units={col.days.length}
              wordCount={wc}
            />
          );
        })}

        {/* 5. My Words — personal list last */}
        <CollectionCard
          href="/my-words"
          icon="✍️"
          title="My Words"
          desc={importedCount > 0 ? `${importedCount} words · your personal list` : 'Your personal word list — add your first word'}
          meta={{ gradient: 'linear-gradient(135deg, #6c63ff 0%, #a78bfa 100%)', edge: '#3f38cc', glow: 'rgba(108,99,255,0.45)' }}
        />
      </div>
    </div>
  );
}
