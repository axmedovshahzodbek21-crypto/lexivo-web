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
          className="btn-icon text-lg"
          aria-label="Go back"
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Foundation — A1 · A2 · B1 */}
          <Link
            href="/leveled-words/foundation"
            className="group relative rounded-3xl p-5 flex flex-col justify-between min-h-[168px] transition-all duration-200 hover:-translate-y-1"
            style={{
              background: 'linear-gradient(135deg, #1a9a50, #2ECC71)',
              boxShadow: '0 10px 0 #0f6634, 0 18px 40px rgba(46,204,113,0.4)',
              textShadow: '0 1px 3px rgba(0,0,0,0.35)',
            }}
          >
            <div className="flex items-start justify-between">
              <span className="text-4xl" style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.35))' }}>🌱</span>
              <span className="text-xs font-black px-2 py-1 rounded-full text-white" style={{ background: 'rgba(0,0,0,0.25)' }}>
                A1 · A2 · B1
              </span>
            </div>
            <div>
              <div className="text-xl font-black text-white leading-tight">Foundation</div>
              <div className="text-xs text-white/80 mt-1">Beginner to Intermediate vocabulary</div>
            </div>
            <span className="absolute bottom-5 right-5 text-lg font-black text-white opacity-0 group-hover:opacity-100 transition-opacity">→</span>
          </Link>

          {/* Advanced — B2 · C1 · C2 */}
          <Link
            href="/collections/Advanced"
            className="group relative rounded-3xl p-5 flex flex-col justify-between min-h-[168px] transition-all duration-200 hover:-translate-y-1"
            style={{
              background: 'linear-gradient(135deg, #6d28d9, #a855f7)',
              boxShadow: '0 10px 0 #4c1d95, 0 18px 40px rgba(109,40,217,0.4)',
              textShadow: '0 1px 3px rgba(0,0,0,0.35)',
            }}
          >
            <div className="flex items-start justify-between">
              <span className="text-4xl" style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.35))' }}>🎓</span>
              <span className="text-xs font-black px-2 py-1 rounded-full text-white" style={{ background: 'rgba(0,0,0,0.25)' }}>
                B2 · C1 · C2
              </span>
            </div>
            <div>
              <div className="text-xl font-black text-white leading-tight">Advanced</div>
              <div className="text-xs text-white/80 mt-1">Upper-Intermediate to Mastery vocabulary</div>
            </div>
            <span className="absolute bottom-5 right-5 text-lg font-black text-white opacity-0 group-hover:opacity-100 transition-opacity">→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
