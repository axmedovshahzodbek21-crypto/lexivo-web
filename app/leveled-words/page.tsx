'use client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LeveledWordsPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col min-h-screen animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-[var(--border)]">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-lg"
        >
          ←
        </button>
        <h1 className="font-bold text-[var(--text)]">📚 Leveled Words</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Info banner */}
        <div className="card flex items-center gap-3 bg-[var(--primary-bg)]">
          <span className="text-2xl">📚</span>
          <p className="text-sm text-[var(--text)] flex-1 leading-relaxed">
            Learn vocabulary sorted by CEFR level — from beginner to mastery.
          </p>
        </div>

        {/* Foundation — A1 · A2 · B1 */}
        <Link
          href="/leveled-words/foundation"
          className="flex items-center gap-4 p-5 rounded-2xl bg-[var(--surface)] border-2 cursor-pointer hover:opacity-90 transition-opacity"
          style={{
            borderColor: 'rgba(46,204,113,0.35)',
            boxShadow: '0 4px 14px rgba(46,204,113,0.14)',
          }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
            style={{ background: 'rgba(46,204,113,0.12)' }}
          >
            🌱
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-lg font-bold" style={{ color: '#2ECC71' }}>Foundation</div>
            <div className="text-sm font-medium text-[var(--text)] mt-0.5">A1 · A2 · B1</div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">Beginner to Intermediate vocabulary</div>
          </div>
          <span className="flex-shrink-0 text-sm font-semibold" style={{ color: '#2ECC71' }}>→</span>
        </Link>

        {/* Advanced — B2 · C1 · C2 */}
        <Link
          href="/collections/Advanced"
          className="flex items-center gap-4 p-5 rounded-2xl bg-[var(--surface)] border-2 cursor-pointer hover:opacity-90 transition-opacity"
          style={{
            borderColor: 'rgba(155,89,182,0.35)',
            boxShadow: '0 4px 14px rgba(155,89,182,0.14)',
          }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
            style={{ background: 'rgba(155,89,182,0.12)' }}
          >
            🎓
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-lg font-bold" style={{ color: '#9B59B6' }}>Advanced</div>
            <div className="text-sm font-medium text-[var(--text)] mt-0.5">B2 · C1 · C2</div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">Upper-Intermediate to Mastery vocabulary</div>
          </div>
          <span className="flex-shrink-0 text-sm font-semibold" style={{ color: '#9B59B6' }}>→</span>
        </Link>
      </div>
    </div>
  );
}
