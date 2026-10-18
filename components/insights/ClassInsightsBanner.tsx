'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useTranslation } from '@/lib/useTranslation';
import { translations } from '@/lib/i18n';
import { fillPlain } from '@/lib/class-insights';

// One line on the teacher dashboard's Students tab pointing at the insights
// screen: today's class summary, e.g. "Bugun 3 nafar o'quvchiga e'tibor kerak."
export default function ClassInsightsBanner({ classId }: { classId: string }) {
  const tt = useTranslation();
  const t = tt.classInsights;
  const useUzbek = tt === translations.uz;
  const [summary, setSummary] = useState<{ uz: string; en: string | null; count: number; total: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: cls } = await supabase
        .from('class_insight_class_snapshots')
        .select('attention_count, student_count, summary_template_id')
        .eq('class_id', classId)
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || !cls?.summary_template_id) return;
      const { data: tpl } = await supabase
        .from('insight_templates')
        .select('text_uz, text_en')
        .eq('id', cls.summary_template_id)
        .maybeSingle();
      if (cancelled || !tpl) return;
      setSummary({ uz: tpl.text_uz, en: tpl.text_en, count: cls.attention_count, total: cls.student_count });
    })();
    return () => { cancelled = true; };
  }, [classId]);

  if (!summary) return null;
  const text = fillPlain(useUzbek ? summary.uz : (summary.en ?? summary.uz), { count: summary.count, total_students: summary.total });

  return (
    <Link
      href={`/classes/${classId}/insights`}
      className="mx-4 mt-3 flex items-center gap-3 rounded-2xl px-4 py-3 transition-opacity hover:opacity-90"
      style={{ background: 'var(--primary-bg)', border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)' }}
    >
      <span className="text-lg shrink-0">✨</span>
      <p className="flex-1 min-w-0 text-sm font-semibold text-[var(--text)]">{text}</p>
      <span className="text-xs font-bold text-[var(--primary)] shrink-0">{t.bannerOpen} →</span>
    </Link>
  );
}
