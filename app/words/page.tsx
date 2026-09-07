'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/useTranslation';
import { getLearnedWords, getStudyHistory } from '@/lib/storage';
import { speak } from '@/lib/speech';
import type { LearnedWord } from '@/lib/types';

// ── "Words learned" ──────────────────────────────────────────────────────────
// Prototype: home "Words" tile lands here. Headline = all-time learned count.
// Compact month heat-strip; tapping a day opens a pop-up with that day's
// words. The full "all words ever learned" list sits below the calendar.
// Personal learning only — class Learn never writes lexivo_learned_words.
// Copy is English-only; wire i18n before shipping.

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MON_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_LABELS = ['M','T','W','T','F','S','S'];
const ACCENT = '#0284c7';

function heat(count: number): string {
  if (count <= 0) return 'transparent';
  const pct = count <= 2 ? 22 : count <= 5 ? 42 : count <= 9 ? 66 : 100;
  return `color-mix(in srgb, ${ACCENT} ${pct}%, transparent)`;
}
const dateKey = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const fmtLong = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${d}, ${y}`;
};
const fmtShort = (key: string) => {
  const [, m, d] = key.split('-').map(Number);
  return `${MON_SHORT[m - 1]} ${d}`;
};

function WordRow({ w, trailing }: { w: LearnedWord; trailing?: string }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <button onClick={() => speak(w.word)}
        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs text-[var(--text-muted)] hover:bg-[var(--primary-bg)] hover:text-[var(--primary)] transition-colors"
        aria-label={`Pronounce ${w.word}`}>🔊</button>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-[var(--text)] leading-tight">{w.word}</div>
        {w.translation && <div className="text-xs text-[var(--text-muted)] truncate">{w.translation}</div>}
      </div>
      {trailing && <span className="shrink-0 text-[11px] text-[var(--text-muted)] truncate max-w-[38%]">{trailing}</span>}
    </div>
  );
}

function DayModal({ dayKey, words, onClose }: { dayKey: string; words: LearnedWord[]; onClose: () => void }) {
  const t = useTranslation();
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);
  const collections = Array.from(new Set(words.map(w => w.collectionName).filter(Boolean)));
  const oneCollection = collections.length === 1 ? collections[0] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl animate-slide-up flex flex-col"
        style={{ maxHeight: '85vh', background: 'var(--surface)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1 shrink-0 sm:hidden">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
        </div>
        <div className="flex items-start justify-between gap-3 px-5 pt-3 pb-3 shrink-0">
          <div>
            <h3 className="text-lg font-black text-[var(--text)]">{fmtLong(dayKey)}</h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {words.length} {words.length === 1 ? t.wordsPage.word : t.wordsPage.words}
              {oneCollection && <> · {oneCollection}</>}
            </p>
          </div>
          <button onClick={onClose}
            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-colors">✕</button>
        </div>
        <div className="overflow-y-auto px-2 pb-4 divide-y divide-[var(--border)]">
          {words.map((w, i) => (
            <WordRow key={`${w.word}-${i}`} w={w} trailing={oneCollection ? undefined : w.collectionName} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function WordsPage() {
  const t = useTranslation();
  const learned = useMemo<LearnedWord[]>(() => getLearnedWords(), []);
  const history = useMemo(() => getStudyHistory(), []); // { "2026-06-15": 8, ... }

  const byDay = useMemo(() => {
    const map: Record<string, LearnedWord[]> = {};
    for (const w of learned) {
      const key = (w.learnedAt || '').split('T')[0];
      if (key) (map[key] ??= []).push(w);
    }
    return map;
  }, [learned]);

  // full list, newest learned first
  const allWords = useMemo(
    () => learned
      .map(w => ({ w, key: (w.learnedAt || '').split('T')[0] }))
      .sort((a, b) => b.key.localeCompare(a.key)),
    [learned],
  );

  const totalDays = Object.keys(byDay).length;
  const bestDay = useMemo(() => Math.max(0, ...Object.values(history)), [history]);
  const latestActive = allWords[0]?.key;

  const now = new Date();
  const [calMonth, setCalMonth] = useState(() =>
    latestActive
      ? new Date(Number(latestActive.slice(0, 4)), Number(latestActive.slice(5, 7)) - 1, 1)
      : new Date(now.getFullYear(), now.getMonth(), 1),
  );
  const [modalDay, setModalDay] = useState<string | null>(null);

  const y = calMonth.getFullYear();
  const m = calMonth.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const firstWeekday = (new Date(y, m, 1).getDay() + 6) % 7;
  const todayStr = dateKey(now.getFullYear(), now.getMonth(), now.getDate());
  const canGoNext = new Date(y, m + 1, 1) <= new Date(now.getFullYear(), now.getMonth(), 1);
  const monthTotal = useMemo(() => {
    let s = 0;
    for (let d = 1; d <= daysInMonth; d++) s += history[dateKey(y, m, d)] ?? 0;
    return s;
  }, [history, y, m, daysInMonth]);

  return (
    <div className="p-4 pb-16 space-y-5 max-w-xl mx-auto animate-fade-in">
      <div>
        <Link href="/" className="text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
          {t.hub.backHome}
        </Link>
        <h1 className="text-2xl font-bold text-[var(--text)] mt-2">{t.wordsPage.title}</h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">
          <b className="text-[var(--text)]">{learned.length}</b> {t.wordsPage.words}
          {' · '}<b className="text-[var(--text)]">{totalDays}</b> {totalDays === 1 ? t.wordsPage.day : t.wordsPage.days}
          {bestDay > 0 && <> · {t.wordsPage.bestDay} <b className="text-[var(--text)]">{bestDay}</b></>}
        </p>
      </div>

      {/* ── Month heat-strip — tap a day for its words ── */}
      <div className="rounded-xl p-3" style={{ background: 'var(--surface-2)' }}>
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => setCalMonth(new Date(y, m - 1, 1))}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[var(--border)] transition-colors"
            style={{ color: ACCENT }} aria-label="Previous month">‹</button>
          <span className="text-sm font-bold text-[var(--text)]">
            {MONTH_NAMES[m]} {y}
            {monthTotal > 0 && <span className="ml-2 text-xs font-semibold text-[var(--text-muted)]">{monthTotal} {t.wordsPage.words}</span>}
          </span>
          <button onClick={() => canGoNext && setCalMonth(new Date(y, m + 1, 1))}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[var(--border)] transition-colors"
            style={{ color: canGoNext ? ACCENT : 'var(--border)', cursor: canGoNext ? 'pointer' : 'default' }}
            aria-label="Next month">›</button>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {DAY_LABELS.map((d, i) => (
            <div key={i} className="text-center text-[9px] font-bold text-[var(--text-muted)] pb-0.5">{d}</div>
          ))}
          {Array.from({ length: firstWeekday }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const key = dateKey(y, m, day);
            const count = history[key] ?? 0;
            const has = count > 0;
            const strong = count > 5;
            return (
              <button key={day} disabled={!has} onClick={() => setModalDay(key)}
                className="h-8 rounded-md flex flex-col items-center justify-center leading-none transition-all hover:brightness-110"
                style={{
                  background: heat(count),
                  outline: key === todayStr ? `1.5px solid ${ACCENT}` : 'none',
                  outlineOffset: -1,
                  cursor: has ? 'pointer' : 'default',
                }}>
                <span className="text-[10px] font-bold"
                  style={{ color: strong ? 'white' : has ? 'var(--text)' : 'var(--text-muted)' }}>{day}</span>
                {has && (
                  <span className="text-[8px] mt-0.5"
                    style={{ color: strong ? 'rgba(255,255,255,0.85)' : 'var(--text-muted)' }}>{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── All words ever learned ── */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-2 px-1">
          {t.wordsPage.allWords} · {learned.length}
        </h2>
        {allWords.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] px-1">{t.wordsPage.empty}</p>
        ) : (
          <div className="rounded-xl overflow-hidden border border-[var(--border)] divide-y divide-[var(--border)]">
            {allWords.map(({ w, key }, i) => (
              <WordRow key={`${w.word}-${i}`} w={w} trailing={key ? fmtShort(key) : undefined} />
            ))}
          </div>
        )}
      </div>

      {modalDay && (
        <DayModal dayKey={modalDay} words={byDay[modalDay] ?? []} onClose={() => setModalDay(null)} />
      )}
    </div>
  );
}
