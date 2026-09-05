'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  getDueStructures, gradeStructureSRS, structureReviewXP, getStructuresSRS, removeStructureFromSRS,
  addXP, displayXP, GRADUATED_INTERVAL_DAYS,
} from '@/lib/storage';
import { pickByStage } from '@/lib/srs';
import type { SRSStructure } from '@/lib/types';

// Each grade is applied to storage immediately (adaptive ease/interval math
// lives in gradeStructureSRS) — unlike the old fixed-ladder version, there's
// no need to defer everything to a session-end batch, since there's no
// review-log bookkeeping left to do at once.
export default function StructuresReviewPage() {
  const router = useRouter();
  const [queue, setQueue] = useState<SRSStructure[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [knewCount, setKnewCount] = useState(0);
  const [notYetCount, setNotYetCount] = useState(0);
  const [done, setDone] = useState(false);
  const [sessionXP, setSessionXP] = useState(0);
  const [managing, setManaging] = useState(false);
  const [allItems, setAllItems] = useState<SRSStructure[]>([]);
  const grading = useRef(false);

  useEffect(() => {
    const due = getDueStructures();
    setAllItems(getStructuresSRS());
    setQueue(due);
    if (due.length === 0) setDone(true);
  }, []);

  const current = queue[index];

  const grade = useCallback((g: 'knew' | 'notYet') => {
    if (!current || grading.current) return;
    grading.current = true;
    setTimeout(() => { grading.current = false; }, 100);

    const updated = gradeStructureSRS(current.id, g);
    if (g === 'knew') {
      setKnewCount(c => c + 1);
      if (updated) {
        const xpGained = structureReviewXP(updated.interval);
        addXP(xpGained, 'Structure', 'Review');
        setSessionXP(prev => prev + xpGained);
      }
    } else {
      setNotYetCount(c => c + 1);
    }

    if (index + 1 >= queue.length) {
      setDone(true);
    } else {
      setIndex(i => i + 1);
      setRevealed(false);
    }
  }, [current, index, queue]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (managing) { if (e.key === 'Escape') setManaging(false); return; }
      if (!current) return;
      switch (e.key) {
        case ' ': case 'Enter': e.preventDefault(); if (!revealed) setRevealed(true); break;
        case 'ArrowRight': case 'k': case 'K': if (revealed) grade('knew'); break;
        case 'ArrowLeft': case 'j': case 'J': if (revealed) grade('notYet'); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [current, revealed, managing, grade]);

  const handleRemove = (id: string) => {
    removeStructureFromSRS(id);
    setAllItems(prev => prev.filter(s => s.id !== id));
    setQueue(prev => prev.filter(s => s.id !== id));
  };

  // Stage bucket for the color scale, derived from the adaptive interval
  // rather than a count of completed fixed steps (there are none anymore).
  const stageForInterval = (interval: number) => {
    const thresholds = [1, 3, 7, 14, 30, GRADUATED_INTERVAL_DAYS];
    return thresholds.filter(t => interval >= t).length;
  };

  if (managing) {
    const graduated = allItems.filter(s => s.interval >= GRADUATED_INTERVAL_DAYS);
    const learning  = allItems.filter(s => s.interval < GRADUATED_INTERVAL_DAYS);

    return (
      <div className="flex flex-col min-h-screen">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <button onClick={() => setManaging(false)} className="btn-icon" aria-label="Go back">←</button>
          <h1 className="font-bold">Manage Structures Deck</h1>
          <span className="text-sm text-[var(--text-muted)]">{allItems.length} items</span>
        </div>

        {allItems.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-6">
            <div className="text-5xl">📭</div>
            <p className="font-semibold text-[var(--text)]">No structures in your deck yet</p>
            <p className="text-sm text-[var(--text-muted)]">Click "Learned" on structures in Discover to add them here.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto p-4 space-y-4">
            {learning.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">
                  In Progress · {learning.length}
                </h2>
                <div className="space-y-2">
                  {learning.map(s => (
                    <StructureManageRow key={s.id} item={s} stage={stageForInterval(s.interval)} onRemove={handleRemove} />
                  ))}
                </div>
              </section>
            )}
            {graduated.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">
                  Graduated · {graduated.length}
                </h2>
                <div className="space-y-2">
                  {graduated.map(s => (
                    <StructureManageRow key={s.id} item={s} stage={stageForInterval(s.interval)} onRemove={handleRemove} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    );
  }

  if (done && queue.length === 0) {
    return (
      <div className="p-6 text-center flex flex-col items-center justify-center min-h-screen animate-fade-in">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold mb-2">All caught up</h2>
        <p className="text-[var(--text-muted)] mb-6">No structures due for review right now.</p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Link href="/structures" className="btn-primary text-center">Back to Structures</Link>
          <button onClick={() => { setAllItems(getStructuresSRS()); setManaging(true); }} className="btn-secondary">
            Manage deck ({allItems.length} items)
          </button>
        </div>
      </div>
    );
  }

  if (done) {
    const total = knewCount + notYetCount;
    const score = total > 0 ? Math.round((knewCount / total) * 100) : 0;
    return (
      <div className="p-6 text-center flex flex-col items-center justify-center min-h-screen animate-fade-in">
        <div className="text-6xl mb-4">{score >= 80 ? '🧠' : '💪'}</div>
        <h2 className="text-2xl font-bold mb-2">Review complete</h2>
        <p className="text-[var(--text-muted)] mb-6">{knewCount}/{total} knew · +{displayXP(sessionXP)} XP</p>
        <div className="grid grid-cols-3 gap-2 w-full mb-6">
          <div className="card text-center"><div className="text-xl font-bold text-[var(--success)]">{knewCount}</div><div className="text-xs text-[var(--text-muted)]">Correct</div></div>
          <div className="card text-center"><div className="text-xl font-bold text-[var(--danger)]">{notYetCount}</div><div className="text-xs text-[var(--text-muted)]">Not yet</div></div>
          <div className="card text-center"><div className="text-xl font-bold text-[var(--primary)]">{score}%</div><div className="text-xs text-[var(--text-muted)]">Score</div></div>
        </div>
        <Link href="/structures" className="btn-primary w-full text-center mb-3">Back to Structures</Link>
        <button onClick={() => { setAllItems(getStructuresSRS()); setManaging(true); }} className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] underline">
          Manage deck
        </button>
      </div>
    );
  }

  if (!current) return null;

  const progress = ((index + 1) / queue.length) * 100;

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex items-center justify-between p-4">
        <button onClick={() => router.back()} className="btn-icon" aria-label="Go back">✕</button>
        <div className="text-center">
          <div className="font-semibold text-sm">Structures Review</div>
          <div className="text-xs text-[var(--text-muted)]">{index + 1} / {queue.length}</div>
        </div>
        <button
          onClick={() => { setAllItems(getStructuresSRS()); setManaging(true); }}
          className="btn-icon text-sm"
          aria-label="Manage deck"
        >
          ⚙️
        </button>
      </div>

      <div className="px-4">
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="flex-1 p-4 flex flex-col gap-4">
        <div className="flex items-center justify-end">
          <div className="badge text-xs" style={{ background: '#4338ca20', color: '#4338ca' }}>
            Every {current.interval}d so far
          </div>
        </div>

        <div
          className="card animate-slide-up flex flex-col gap-3"
          style={{ minHeight: 280, borderLeft: '3px solid var(--primary)' }}
        >
          <div className="flex flex-wrap gap-1.5">
            {current.ieltsUse.map(tag => (
              <span key={tag} className="badge text-xs">{tag}</span>
            ))}
          </div>
          <h2 className="text-2xl font-bold text-[var(--text)] leading-snug">{current.pattern}</h2>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">💭 {current.scenario}</p>

          {revealed ? (
            <div className="space-y-3 animate-fade-in">
              <div className="bg-[var(--primary-bg)] rounded-xl p-3">
                <p className="text-xs font-semibold text-[var(--primary)] mb-1">Translation</p>
                <p className="text-lg font-semibold text-[var(--primary)]">{current.uzTranslation}</p>
              </div>
              <p className="text-sm text-[var(--text)]">{current.definition}</p>
              <p className="text-sm text-[var(--text-muted)]">{current.uzDefinition}</p>
              {current.examples.map((ex, i) => (
                <div key={i} className="bg-[var(--surface-2)] rounded-xl p-3 space-y-1">
                  <p className="text-xs italic text-[var(--text-muted)]">"{ex}"</p>
                  <p className="text-xs italic text-[var(--text-muted)]">"{current.exampleTranslations[i]}"</p>
                </div>
              ))}
            </div>
          ) : (
            <button
              onClick={() => setRevealed(true)}
              className="mt-4 w-full py-4 rounded-xl font-bold text-white transition-all"
              style={{
                background: 'linear-gradient(135deg, var(--primary), #818CF8)',
                boxShadow: '0 4px 0 #4338CA, 0 8px 24px color-mix(in srgb, var(--primary) 45%, transparent)',
                letterSpacing: '0.04em',
              }}
            >
              Reveal
            </button>
          )}
        </div>

        {revealed && (
          <div className="flex gap-3 animate-slide-up">
            <button
              onClick={() => grade('notYet')}
              className="flex-1 rounded-2xl text-white font-bold transition-all active:scale-95 flex flex-col items-center justify-center gap-1"
              style={{ padding: '20px 16px', background: 'linear-gradient(135deg, #EF4444, #DC2626)', boxShadow: '0 4px 0 #991B1B, 0 8px 24px #EF444455' }}
            >
              <span className="text-2xl leading-none">✗</span>
              <span className="text-sm font-black">Not Yet</span>
              <span className="text-xs opacity-60">← J</span>
            </button>
            <button
              onClick={() => grade('knew')}
              className="flex-1 rounded-2xl text-white font-bold transition-all active:scale-95 flex flex-col items-center justify-center gap-1"
              style={{ padding: '20px 16px', background: 'linear-gradient(135deg, #22C55E, #16A34A)', boxShadow: '0 4px 0 #15803D, 0 8px 24px #22C55E55' }}
            >
              <span className="text-2xl leading-none">✓</span>
              <span className="text-sm font-black">Knew It</span>
              <span className="text-xs opacity-60">K →</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StructureManageRow({
  item, stage, onRemove,
}: {
  item: SRSStructure;
  stage: number;
  onRemove: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const graduated = item.interval >= GRADUATED_INTERVAL_DAYS;
  const colors = ['#9CA3AF', '#F59E0B', '#EF4444', '#8B5CF6', '#3B82F6', '#10B981'];
  const color = pickByStage(stage, colors);

  return (
    <div className="card flex items-center gap-3 py-3">
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[var(--text)] truncate">{item.pattern}</p>
        <p className="text-xs text-[var(--text-muted)] truncate">{item.uzTranslation}</p>
      </div>
      <span
        className="badge text-xs shrink-0"
        style={{ background: `${color}20`, color }}
      >
        {graduated ? 'Graduated' : `Every ${item.interval}d`}
      </span>

      {confirming ? (
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => { onRemove(item.id); setConfirming(false); }}
            className="text-xs px-2 py-1 rounded-lg bg-red-100 text-red-700 font-semibold"
          >
            Remove
          </button>
          <button onClick={() => setConfirming(false)} className="text-xs px-2 py-1 rounded-lg bg-[var(--surface-2)] text-[var(--text-muted)]">
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          className="text-xs px-2 py-1 rounded-lg bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-red-500 shrink-0"
          aria-label="Remove from deck"
        >
          ✕
        </button>
      )}
    </div>
  );
}
