'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import BackButton from '@/components/BackButton';
import { useTranslation } from '@/lib/useTranslation';
import { getDebateTopic, isBattleReady, DEBATE_STEPS, type DebateSide } from '@/lib/debateMock';
import { DEBATE_CONTENT } from '@/lib/debateContent';
import { getStepIndex } from '@/lib/debateProgress';

export default function DebateTopicPage() {
  const t = useTranslation();
  const params = useParams();
  const slug = String(params.topic);
  const topic = getDebateTopic(slug);
  const [side, setSide] = useState<DebateSide | null>(null);
  const hasContent = slug in DEBATE_CONTENT;
  const [liveSteps, setLiveSteps] = useState<{ for: number; against: number } | null>(null);

  useEffect(() => {
    if (!hasContent) return;
    setLiveSteps({ for: getStepIndex(slug, 'for'), against: getStepIndex(slug, 'against') });
  }, [slug, hasContent]);

  if (!topic) notFound();

  const forPct = liveSteps ? Math.round((liveSteps.for / DEBATE_STEPS.length) * 100) : topic.progress.for;
  const againstPct = liveSteps ? Math.round((liveSteps.against / DEBATE_STEPS.length) * 100) : topic.progress.against;
  const ready = hasContent ? forPct >= 80 && againstPct >= 80 : isBattleReady(topic);
  const activeStepsDone = side === 'for'
    ? (liveSteps ? liveSteps.for : topic.stepsDone.for)
    : side === 'against'
    ? (liveSteps ? liveSteps.against : topic.stepsDone.against)
    : 0;

  return (
    <div className="p-4 space-y-6 animate-fade-in max-w-2xl mx-auto">
      <BackButton href="/debate" label={t.debatePage.topics} />

      <div className="flex items-center gap-3">
        <span className="text-3xl">{topic.emoji}</span>
        <h1 className="text-2xl font-bold text-[var(--text)]">{topic.title}</h1>
        {ready && (
          <span className="ml-auto text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-300">
            🏅 {t.debatePage.battleReadyBadge}
          </span>
        )}
      </div>

      {/* Side selector */}
      <div className="grid grid-cols-2 gap-3">
        <SideCard
          label={t.debatePage.forLabel}
          color="#22c55e"
          edge="#15803d"
          pct={forPct}
          active={side === 'for'}
          onClick={() => setSide('for')}
          statusStart={t.debatePage.statusStart}
          statusMastered={t.debatePage.statusMastered}
          statusContinue={t.debatePage.statusContinue}
        />
        <SideCard
          label={t.debatePage.againstLabel}
          color="#ef4444"
          edge="#b91c1c"
          pct={againstPct}
          active={side === 'against'}
          onClick={() => setSide('against')}
          statusStart={t.debatePage.statusStart}
          statusMastered={t.debatePage.statusMastered}
          statusContinue={t.debatePage.statusContinue}
        />
      </div>

      {/* Step path for chosen side */}
      {side && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="text-xs font-bold text-[var(--text-muted)] mb-3 uppercase tracking-wide">
            {side === 'for' ? t.debatePage.arguingForPath : t.debatePage.arguingAgainstPath}
          </div>
          <div className="flex items-center justify-between mb-4">
            {DEBATE_STEPS.map((step, i) => {
              const done = i < activeStepsDone;
              const current = i === activeStepsDone;
              const locked = i > activeStepsDone;
              return (
                <div key={step.key} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-sm border-2 ${
                        done ? 'bg-green-500 border-green-600 text-white'
                        : current ? 'bg-[var(--surface)] border-indigo-500 text-indigo-500'
                        : 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-muted)] opacity-60'
                      }`}
                    >
                      {done ? '✓' : locked ? '🔒' : step.icon}
                    </div>
                    <span className="text-[10px] text-[var(--text-muted)] text-center w-14 leading-tight">{step.label}</span>
                  </div>
                  {i < DEBATE_STEPS.length - 1 && (
                    <div className={`h-0.5 flex-1 mx-1 ${done ? 'bg-green-500' : 'bg-[var(--border)]'}`} />
                  )}
                </div>
              );
            })}
          </div>

          {hasContent ? (
            <Link
              href={`/debate/${slug}/${side}/${DEBATE_STEPS[Math.min(activeStepsDone, DEBATE_STEPS.length - 1)].key}`}
              className="block text-center w-full rounded-xl py-3 font-bold text-white text-sm"
              style={{ background: 'linear-gradient(135deg, #4338ca, #818cf8)', boxShadow: '0 6px 0 #312e81' }}
            >
              {activeStepsDone >= DEBATE_STEPS.length
                ? t.debatePage.reviewThisSide
                : t.debatePage.continueStep(DEBATE_STEPS[activeStepsDone].label)}
            </Link>
          ) : (
            <button
              disabled
              className="w-full rounded-xl py-3 font-bold text-white text-sm opacity-50 cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #4338ca, #818cf8)' }}
              title={t.debatePage.contentNotWrittenTooltip}
            >
              {t.debatePage.contentComingSoonBtn}
            </button>
          )}
        </div>
      )}

      {!side && (
        <p className="text-sm text-[var(--text-muted)] text-center py-4">
          {t.debatePage.chooseASide}
        </p>
      )}
    </div>
  );
}

function SideCard({ label, color, edge, pct, active, onClick, statusStart, statusMastered, statusContinue }: {
  label: string; color: string; edge: string; pct: number; active: boolean; onClick: () => void;
  statusStart: string; statusMastered: string; statusContinue: string;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl p-4 text-left transition-transform hover:-translate-y-0.5"
      style={{
        background: active ? `linear-gradient(135deg, ${color}, ${color}cc)` : 'var(--surface)',
        border: active ? 'none' : `2px solid var(--border)`,
        boxShadow: active ? `0 8px 0 ${edge}` : 'none',
      }}
    >
      <div className={`font-bold text-sm ${active ? 'text-white' : 'text-[var(--text)]'}`}>{label}</div>
      <div className={`text-2xl font-extrabold mt-1 ${active ? 'text-white' : 'text-[var(--text)]'}`}>{pct}%</div>
      <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: active ? 'rgba(255,255,255,0.3)' : 'var(--surface-2)' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: active ? 'white' : color }} />
      </div>
      <div className={`text-[10px] mt-1.5 ${active ? 'text-white/80' : 'text-[var(--text-muted)]'}`}>
        {pct === 0 ? statusStart : pct >= 100 ? statusMastered : statusContinue}
      </div>
    </button>
  );
}
