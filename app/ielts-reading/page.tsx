'use client';
import Link from 'next/link';

const PASSAGES = [
  { id: 1, label: 'Passage 1', desc: 'Academic texts on general interest topics' },
  { id: 2, label: 'Passage 2', desc: 'Work-related or social topics' },
  { id: 3, label: 'Passage 3', desc: 'Complex academic or analytical texts' },
];

export default function IeltsReadingPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-24">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-[var(--text)]">📝 IELTS Reading</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Choose a passage section to begin. Each passage has 30 tests.</p>
      </div>

      <div className="flex flex-col gap-4">
        {PASSAGES.map(p => (
          <Link key={p.id} href={`/ielts-reading/${p.id}`}>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)] hover:bg-[var(--primary-bg)] transition-all duration-200 p-6 cursor-pointer group flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-[var(--text-muted)] group-hover:text-[var(--primary)] uppercase tracking-wider mb-1">{p.label}</p>
                <p className="text-lg font-black text-[var(--text)] group-hover:text-[var(--primary)] mb-1">{p.label}</p>
                <p className="text-sm text-[var(--text-muted)]">{p.desc}</p>
              </div>
              <span className="text-2xl ml-4 shrink-0 group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
