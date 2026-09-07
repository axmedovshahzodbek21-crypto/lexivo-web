'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/useTranslation';
import { getXP, getXPByDate, displayXP } from '@/lib/storage';
import { getLevelInfo } from '@/lib/gamification';
import { LEVEL_THRESHOLDS } from '@/lib/types';

// ── Levels ───────────────────────────────────────────────────────────────────
// Prototype: the home "Starter" tile lands here. Vertical progression through
// LEVEL_THRESHOLDS — past levels with the date they were reached, the current
// level with progress to next, future levels locked with their XP gate.
// Dates are derived from lifetime XP-per-day (getXPByDate): the first day the
// running total crosses a threshold. Day-precision, and only as far back as
// xp_by_date has data — older crossings show as "reached earlier".
// Copy is English-only; wire i18n before shipping.

const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtDate = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return `${MON[m - 1]} ${d}, ${y}`;
};

// one accent per tier (LEVEL_COLORS in lib/colors is only partial)
const TIER_COLOR: Record<string, string> = {
  'Starter':            '#94a3b8',
  'Beginner':           '#2ECC71',
  'Elementary':         '#22c55e',
  'Pre-Intermediate':   '#14b8a6',
  'Intermediate':       '#3498DB',
  'Upper-Intermediate': '#2980B9',
  'Advanced':           '#9B59B6',
  'Expert':             '#a855f7',
  'Master':             '#F39C12',
  'Legend':             '#f43f5e',
};

export default function LevelsPage() {
  const t = useTranslation();
  const xp = useMemo(() => getXP(), []);
  const info = useMemo(() => getLevelInfo(xp), [xp]);

  // derive the date each threshold was first crossed
  const reachedOn = useMemo(() => {
    const byDate = getXPByDate();
    const dates = Object.keys(byDate).sort();
    const out: Record<string, string> = {};
    let cum = 0;
    let ti = 0;
    for (const d of dates) {
      cum += byDate[d] || 0;
      while (ti < LEVEL_THRESHOLDS.length && cum >= LEVEL_THRESHOLDS[ti].min) {
        if (LEVEL_THRESHOLDS[ti].min > 0) out[LEVEL_THRESHOLDS[ti].level] = d;
        ti++;
      }
    }
    return out;
  }, []);

  const reachedCount = LEVEL_THRESHOLDS.filter(l => xp >= l.min).length;

  return (
    <div className="p-4 pb-16 space-y-5 max-w-xl mx-auto animate-fade-in">
      <div>
        <Link href="/" className="text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
          {t.hub.backHome}
        </Link>
        <h1 className="text-2xl font-bold text-[var(--text)] mt-2">{t.levels.title}</h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">
          <b className="text-[var(--text)]">{info.level}</b> · {displayXP(xp)} XP
          {info.next && <> · {displayXP(info.xpToNext)} XP → {info.next}</>}
          {' · '}<b className="text-[var(--text)]">{reachedCount}</b>/{LEVEL_THRESHOLDS.length} {t.levels.levelsCount}
        </p>
      </div>

      <ol className="relative">
        {LEVEL_THRESHOLDS.map((lvl, i) => {
          const reached = xp >= lvl.min;
          const isCurrent = lvl.level === info.level;
          const color = TIER_COLOR[lvl.level] ?? '#6C63FF';
          const date = reachedOn[lvl.level];
          const last = i === LEVEL_THRESHOLDS.length - 1;

          return (
            <li key={lvl.level} className="relative flex gap-3 pb-4">
              {/* rail */}
              <div className="flex flex-col items-center shrink-0">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0"
                  style={{
                    background: reached ? color : 'transparent',
                    border: reached ? 'none' : `2px solid var(--border)`,
                    color: reached ? 'white' : 'var(--text-muted)',
                    boxShadow: isCurrent ? `0 0 0 4px color-mix(in srgb, ${color} 25%, transparent)` : 'none',
                  }}>
                  {reached ? (isCurrent ? '★' : '✓') : i + 1}
                </div>
                {!last && (
                  <div className="w-0.5 flex-1 mt-1"
                    style={{ background: xp >= LEVEL_THRESHOLDS[i + 1].min ? color : 'var(--border)' }} />
                )}
              </div>

              {/* body */}
              <div className={`flex-1 min-w-0 rounded-xl px-3 py-2.5 ${isCurrent ? '' : ''}`}
                style={{
                  background: isCurrent ? `color-mix(in srgb, ${color} 12%, var(--surface-2))` : 'var(--surface-2)',
                  border: isCurrent ? `1px solid color-mix(in srgb, ${color} 45%, transparent)` : '1px solid var(--border)',
                  opacity: reached || isCurrent ? 1 : 0.7,
                }}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-bold" style={{ color: reached ? 'var(--text)' : 'var(--text-muted)' }}>
                    {lvl.level}
                  </span>
                  <span className="text-[11px] font-semibold text-[var(--text-muted)] shrink-0">
                    {lvl.min === 0 ? t.levels.start : `${displayXP(lvl.min)} XP`}
                  </span>
                </div>

                {isCurrent && info.next ? (
                  <div className="mt-1.5">
                    <div className="h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${info.progress}%`, background: color }} />
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)] mt-1">
                      {displayXP(info.xpToNext)} XP → {info.next}
                    </div>
                  </div>
                ) : reached ? (
                  <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    {lvl.min === 0 ? t.levels.whereBegins : date ? `${t.levels.reached} ${fmtDate(date)}` : t.levels.reachedEarlier}
                  </div>
                ) : (
                  <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    {displayXP(lvl.min - xp)} XP {t.levels.xpToUnlock}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
