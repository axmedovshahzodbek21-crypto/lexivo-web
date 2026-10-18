'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useClassInsights } from '@/components/insights/useClassInsights';
import InsightText from '@/components/insights/InsightText';
import {
  type StudentInsight, dotColor, fillPlain, needsAttention, renderParagraph, templateText, trendArrow,
} from '@/lib/class-insights';

type Filter = 'all' | 'attention' | 'well';

export default function ClassInsightsListPage() {
  const { id } = useParams<{ id: string }>();
  const { loading, notTeacher, className, data, sorted, lang, nameOf, tt, query } = useClassInsights(id);
  const t = tt.classInsights;
  const [filter, setFilter] = useState<Filter>('all');

  if (loading) {
    return <div className="flex justify-center py-16"><div className="text-4xl animate-bounce">✨</div></div>;
  }
  if (notTeacher) {
    return <p className="p-8 text-center text-[var(--text-muted)]">{tt.classesPage.onlyTeacherDashboard}</p>;
  }

  const header = (
    <div className="flex items-baseline justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-black text-[var(--text)]">✨ {t.title}</h1>
        <p className="text-sm text-[var(--text-muted)] truncate">{className}</p>
      </div>
      <p className="text-[10px] text-[var(--text-muted)] shrink-0">{t.updatedDaily}</p>
    </div>
  );

  if (!data) {
    return (
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        {header}
        <div className="card"><p className="text-sm text-[var(--text-muted)]">{t.notReady}</p></div>
      </div>
    );
  }

  const { classRow, templates } = data;
  const tplText = (tid: number | null) => templateText(tid !== null ? templates[tid] : undefined, lang);
  const names = (pred: (r: StudentInsight) => boolean) => sorted.filter(pred).map(r => nameOf(r.student_id)).join(', ');

  const summary = tplText(classRow.summary_template_id);
  const classLines = ([
    { tid: classRow.skipper_template_id, vars: { count: sorted.filter(r => r.kind === 'skipper').length, names: names(r => r.kind === 'skipper') } },
    { tid: classRow.behind_template_id, vars: { count: sorted.filter(r => (r.level ?? 9) <= 3).length, names: names(r => (r.level ?? 9) <= 3) } },
    { tid: classRow.hard_template_id, vars: { count: classRow.hard_words.length, words: classRow.hard_words.map(h => h.word).join(', ') } },
    { tid: classRow.well_template_id, vars: { count: sorted.filter(r => (r.level ?? 0) >= 5).length, names: names(r => (r.level ?? 0) >= 5) } },
  ] as { tid: number | null; vars: Record<string, string | number> }[])
    .map(l => { const text = tplText(l.tid); return text ? fillPlain(text, l.vars) : null; })
    .filter((v): v is string => v !== null);

  const visible = sorted.filter(r =>
    filter === 'all' ? true : filter === 'attention' ? needsAttention(r) : (r.level ?? 0) >= 5);

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: t.filterAll },
    { key: 'attention', label: t.filterAttention },
    { key: 'well', label: t.filterWell },
  ];

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4 animate-fade-in">
      {header}

      {(summary || classLines.length > 0) && (
        <div className="card space-y-2" style={{ padding: 16 }}>
          {summary && (
            <p className="text-base font-bold text-[var(--text)] leading-snug">
              {fillPlain(summary, { count: classRow.attention_count, total_students: classRow.student_count })}
            </p>
          )}
          {classLines.map((line, i) => <p key={i} className="text-sm text-[var(--text)] leading-snug">{line}</p>)}
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`shrink-0 text-xs px-3 py-1.5 rounded-full font-semibold transition-all ${filter === f.key ? 'bg-[var(--primary)] text-white' : 'bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)]'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)] text-center py-8">{t.noStudents}</p>
      ) : (
        <ul className="card divide-y divide-[var(--border)]" style={{ padding: 0 }}>
          {visible.map(r => {
            const headline = renderParagraph(r, templates, nameOf(r.student_id), lang)[0];
            return (
              <li key={r.student_id}>
                <Link
                  href={`/classes/${id}/insights/${r.student_id}${query}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface-2)] transition-colors"
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: dotColor(r) }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <p className="font-bold text-[var(--text)] truncate">{nameOf(r.student_id)}</p>
                      <p className="text-xs text-[var(--text-muted)] shrink-0">
                        {r.score !== null ? `${r.score}%` : '—'} {trendArrow(r.trend)}
                      </p>
                    </div>
                    {headline && (
                      <p className="text-sm text-[var(--text-muted)] truncate"><InsightText segments={headline} /></p>
                    )}
                  </div>
                  <span className="text-[var(--text-muted)] shrink-0">›</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
