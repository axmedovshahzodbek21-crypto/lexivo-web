'use client';
import { use, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { speakAccent } from '@/lib/speech';
import { UNIT_SLUGS, getSubUnitStructures } from '@/lib/structures-data';
import {
  addStructureToSRS, getStructuresNewToday, DISCOVER_DAILY_NEW_CAP,
  addXP, displayXP, getStreak, recordStudySession,
} from '@/lib/storage';
import type { StructureItem } from '@/lib/types';

type Mark = 'learned' | 'skipped' | null;

// Visually mirrors app/learn/page.tsx (vocab Learn): segmented progress dots,
// tap-to-reveal card, per-example reveal-translation cards, a "+ More
// examples" expander, and a stat-tile completion screen. Keeps this
// session's retrieval-first design (scenario shown alone before the
// pattern/meaning) — that's the word Learn card's front-shows-word,
// back-shows-meaning shape, just with the scenario standing in for the word.
export default function UnitDayLearnPage({ params }: { params: Promise<{ unit: string; day: string }> }) {
  const { unit: slug, day: dayParam } = use(params);
  const router = useRouter();
  const unit = UNIT_SLUGS[slug];
  const day = parseInt(dayParam, 10);

  const [structures] = useState<StructureItem[]>(() => unit ? getSubUnitStructures(unit, day) : []);
  const [index, setIndex] = useState(0);
  const [marks, setMarks] = useState<Mark[]>(() => structures.map(() => null));
  const [revealed, setRevealed] = useState(false);
  const [showUz, setShowUz] = useState(false);
  const [showMoreExamples, setShowMoreExamples] = useState(false);
  const [exampleShown, setExampleShown] = useState<boolean[]>([]);
  const [done, setDone] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [sessionXP, setSessionXP] = useState(0);
  const [newToday, setNewToday] = useState(() => getStructuresNewToday());

  const current = structures[index];
  const capReached = newToday >= DISCOVER_DAILY_NEW_CAP;
  const mark = marks[index] ?? null;
  const isMarked = mark != null;
  const showBack = revealed || isMarked;

  useEffect(() => {
    setRevealed(false);
    setShowUz(false);
    setShowMoreExamples(false);
    setExampleShown(current ? current.examples.slice(0, 3).map(() => false) : []);
  }, [current]);

  const advance = useCallback((newMark: Mark) => {
    setMarks(m => { const n = [...m]; n[index] = newMark; return n; });
    if (index + 1 >= structures.length) setDone(true);
    else setIndex(i => i + 1);
  }, [index, structures.length]);

  const markLearned = () => {
    if (!current || capReached) return;
    addStructureToSRS(current);
    const xp = 5;
    addXP(xp, 'Structure', `Day ${day} · ${unit}`);
    recordStudySession();
    setSessionCount(c => c + 1);
    setSessionXP(x => x + xp);
    setNewToday(n => n + 1);
    advance('learned');
  };

  const skip = () => advance('skipped');

  if (!unit || Number.isNaN(day)) {
    return (
      <div className="p-6 text-center flex flex-col items-center justify-center min-h-screen">
        <p className="text-[var(--text-muted)] mb-4">Unknown day.</p>
        <Link href="/structures" className="btn-primary inline-block">Back to Structures</Link>
      </div>
    );
  }

  if (structures.length === 0) {
    return (
      <div className="p-6 text-center flex flex-col items-center justify-center min-h-screen">
        <p className="text-[var(--text-muted)] mb-4">No structures in this day.</p>
        <Link href={`/structures/${slug}/learn`} className="btn-primary inline-block">Back to days</Link>
      </div>
    );
  }

  if (done) {
    const skippedCount = marks.filter(m => m === 'skipped').length;
    return (
      <div className="p-6 animate-fade-in flex flex-col items-center min-h-screen">
        <div className="flex flex-col items-center text-center pt-10 pb-6">
          <div className="text-6xl mb-3 animate-pop">🎉</div>
          <h2 className="text-2xl font-bold text-[var(--text)]">Day complete!</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">{unit} · Day {day}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 w-full mb-4">
          <StatTile icon="🧩" value={sessionCount} label="Structures learned" color="var(--primary)" />
          <StatTile icon="⚡" value={`+${displayXP(sessionXP)}`} label="XP earned" color="var(--warning)" />
          <StatTile icon="🔥" value={getStreak()} label="Day streak" color="#FF6B35" />
          <StatTile icon="⏭️" value={skippedCount} label="Skipped" color={skippedCount > 0 ? 'var(--danger)' : 'var(--success)'} />
        </div>

        <div className="flex flex-col gap-3 w-full mt-auto pt-4">
          <Link href={`/structures/${slug}/flashcards`} className="w-full flex items-center justify-between px-5 py-4 rounded-2xl text-white" style={{ background: 'linear-gradient(135deg, #FF6B35, #FF8C42)' }}>
            <div>
              <div className="font-bold text-sm">Practice Flashcards</div>
              <div className="text-xs opacity-80 mt-0.5">Reinforce what you just learned</div>
            </div>
            <span className="text-lg">→</span>
          </Link>
          <div className="flex gap-3">
            <button
              onClick={() => { setIndex(0); setMarks(structures.map(() => null)); setSessionCount(0); setSessionXP(0); setDone(false); }}
              className="btn-secondary flex-1"
            >
              Again
            </button>
            <Link href={`/structures/${slug}/learn`} className="btn-primary flex-1 text-center">Back to days</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!current) return null;

  const extras = current.examples.slice(3);
  const extraTranslations = current.exampleTranslations.slice(3);
  const cardBg = mark === 'learned' ? '#15803d' : mark === 'skipped' ? '#c2410c' : undefined;
  const cardCssVars = cardBg ? { '--text': '#fff', '--text-muted': 'rgba(255,255,255,0.85)', '--primary': '#fff', '--primary-bg': 'rgba(255,255,255,0.2)', '--surface-2': 'rgba(255,255,255,0.12)', '--surface': 'rgba(255,255,255,0.08)', '--border': 'rgba(255,255,255,0.2)' } as React.CSSProperties : {};

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-2">
        <button onClick={() => router.push(`/structures/${slug}/learn`)} className="btn-icon text-lg" aria-label="Go back">←</button>
        <div className="flex-1 mx-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-[var(--text-muted)] truncate">{unit} · Day {day}</span>
            <span className="text-xs font-bold text-[var(--primary)] px-1 shrink-0">
              {index + 1} <span className="text-[var(--text-muted)] font-normal">/ {structures.length}</span>
            </span>
          </div>
          <div className="flex gap-0.5">
            {structures.map((_, i) => (
              <div
                key={i}
                className="flex-1 rounded-full transition-colors duration-200"
                style={{
                  height: 4,
                  backgroundColor: i === index ? 'var(--primary)' : marks[i] === 'learned' ? '#22c55e' : marks[i] === 'skipped' ? '#f97316' : 'var(--border)',
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {capReached && (
        <div className="mx-4 mt-1 rounded-xl p-3 flex gap-2 items-start text-sm" style={{ background: 'var(--primary-bg)', color: 'var(--primary)' }}>
          <span>🌙</span>
          <span>You've added {DISCOVER_DAILY_NEW_CAP} new structures today — come back tomorrow to mark more as Learned.</span>
        </div>
      )}

      <div className="flex-1 p-4 flex flex-col gap-4">
        {/* Card */}
        <div
          className="card"
          style={{ minHeight: 300, ...(cardBg ? { background: cardBg, borderColor: 'transparent' } : {}), ...cardCssVars }}
        >
          {isMarked && (
            <button
              onClick={() => { setMarks(m => { const n = [...m]; n[index] = null; return n; }); setRevealed(false); }}
              className="mb-3 px-3 py-1.5 rounded-full text-xs font-bold text-white w-fit hover:opacity-80 active:scale-95 transition-all cursor-pointer"
              style={{ background: 'rgba(255,255,255,0.25)' }}
              title="Click to undo this mark"
            >
              {mark === 'learned' ? '✓ Already marked as Learned' : '⏭ Skipped — still counts!'} ✕
            </button>
          )}

          <div className="flex flex-wrap gap-1.5 mb-3">
            {current.ieltsUse.map(tag => (
              <span key={tag} className="badge text-xs">{tag}</span>
            ))}
          </div>

          {!showBack ? (
            <div
              className="cursor-pointer select-none flex flex-col items-center gap-3 text-center py-6"
              onClick={() => setRevealed(true)}
            >
              <div className="rounded-xl p-3 flex gap-2 items-start text-left w-full" style={{ background: 'var(--surface-2)', borderLeft: '3px solid var(--warning)' }}>
                <span className="text-lg flex-shrink-0">💭</span>
                <p className="text-sm text-[var(--text)] leading-relaxed">{current.scenario}</p>
              </div>
              <div className="text-5xl mt-4">🤔</div>
              <p className="text-sm font-medium text-[var(--text-muted)]">Do you know this structure?</p>
              <div className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold pointer-events-none" style={{ background: 'var(--primary-bg)', color: 'var(--primary)' }}>
                Tap to reveal
              </div>
            </div>
          ) : (
            <div className="mt-1 space-y-3 animate-fade-in">
              <div className="rounded-xl p-3 flex gap-2 items-start" style={{ background: 'var(--surface-2)', borderLeft: '3px solid var(--warning)' }}>
                <span className="text-lg flex-shrink-0">💭</span>
                <p className="text-sm text-[var(--text)] leading-relaxed">{current.scenario}</p>
              </div>

              <h2 className="text-2xl font-bold text-[var(--text)] leading-snug">{current.pattern}</h2>
              <p className="text-base font-semibold text-[var(--text)] leading-relaxed">{current.definition}</p>

              <div className="bg-[var(--primary-bg)] rounded-xl p-3">
                <p className="text-xs font-semibold text-[var(--primary)] mb-1">🇺🇿 O'zbek tarjimasi</p>
                <p className="text-sm text-[var(--primary)]">{current.uzTranslation}</p>
              </div>

              <div>
                <button onClick={() => setShowUz(v => !v)} className="text-xs text-[var(--primary)] font-medium hover:underline">
                  {showUz ? 'Yopish' : "O'zbekcha tushuntirish"}
                </button>
                {showUz && <p className="text-sm text-[var(--text-muted)] mt-1 animate-fade-in">{current.uzDefinition}</p>}
              </div>

              {current.examples.slice(0, 3).map((ex, i) => (
                <StructureExampleCard
                  key={i}
                  num={i + 1}
                  example={ex}
                  translation={current.exampleTranslations[i]}
                  shown={exampleShown[i]}
                  onToggle={() => setExampleShown(s => s.map((v, idx) => idx === i ? !v : v))}
                />
              ))}

              {extras.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowMoreExamples(v => !v)}
                    className="text-sm text-[var(--primary)] font-medium hover:underline flex items-center gap-1"
                  >
                    {showMoreExamples ? '− Hide examples' : `+ More examples (${extras.length})`}
                  </button>
                  {showMoreExamples && (
                    <div className="mt-2 space-y-2 animate-fade-in">
                      {extras.map((ex, i) => (
                        <ExtraExampleCard key={i} index={i} example={ex} translation={extraTranslations[i]} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        {!isMarked && (
          <div className="space-y-2">
            {showBack && (
              <div className="flex gap-3 animate-fade-in">
                <button
                  onClick={skip}
                  className="flex-1 py-3.5 rounded-xl border-2 border-[var(--border)] text-[var(--text-muted)] font-semibold text-sm hover:border-orange-300 hover:text-orange-500 transition-colors press-3d"
                >
                  Skip
                </button>
                <button
                  onClick={markLearned}
                  disabled={capReached}
                  className="flex-[2] btn-primary py-3.5 text-center press-3d disabled:opacity-60"
                >
                  ✓ Learned
                </button>
              </div>
            )}
          </div>
        )}

        <div className="text-center text-xs text-[var(--text-muted)]">
          {structures.length - index - 1} remaining
        </div>
      </div>
    </div>
  );
}

function StructureExampleCard({
  num, example, translation, shown, onToggle,
}: {
  num: number; example: string; translation: string; shown: boolean; onToggle: () => void;
}) {
  return (
    <div className="rounded-xl overflow-hidden border border-[var(--border)] cursor-pointer select-none" onClick={onToggle}>
      <div className="bg-[var(--surface-2)] px-3 pt-3 pb-2">
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="text-xs font-semibold text-[var(--primary)] bg-[var(--primary-bg)] px-2 py-0.5 rounded-full">
            Example {num}
          </span>
          <button
            onClick={e => { e.stopPropagation(); speakAccent(example, 'us'); }}
            className="w-6 h-6 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-xs hover:bg-[var(--primary-bg)] transition-colors shrink-0"
            aria-label="Listen"
          >🔊</button>
        </div>
        <p className="text-sm italic text-[var(--text)]">&ldquo;{example}&rdquo;</p>
      </div>
      <div className="px-3 py-2 bg-[var(--surface)]">
        {shown
          ? <p className="text-xs text-[var(--primary)] animate-fade-in">{translation}</p>
          : <p className="text-xs text-[var(--text-muted)] text-center">Tap to see translation</p>}
      </div>
    </div>
  );
}

function ExtraExampleCard({ index, example, translation }: { index: number; example: string; translation: string }) {
  const [show, setShow] = useState(false);
  return (
    <div
      className="rounded-xl overflow-hidden border border-[var(--border)] cursor-pointer select-none"
      onClick={() => setShow(v => !v)}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShow(v => !v); } }}
    >
      <div className="bg-[var(--surface-2)] px-3 pt-2.5 pb-2">
        <span className="text-xs text-[var(--text-muted)]">Extra {index + 1}</span>
        <p className="text-sm italic text-[var(--text)] mt-1">&ldquo;{example}&rdquo;</p>
      </div>
      <div className="px-3 py-2 bg-[var(--surface)]">
        {show
          ? <p className="text-xs text-[var(--primary)] animate-fade-in">{translation}</p>
          : <p className="text-xs text-[var(--text-muted)] text-center">Tap to see translation</p>}
      </div>
    </div>
  );
}

function StatTile({ icon, value, label, color }: { icon: string; value: number | string; label: string; color: string }) {
  return (
    <div className="card flex flex-col items-center py-4 gap-1">
      <span className="text-2xl">{icon}</span>
      <span className="text-2xl font-bold" style={{ color }}>{value}</span>
      <span className="text-xs text-[var(--text-muted)]">{label}</span>
    </div>
  );
}
