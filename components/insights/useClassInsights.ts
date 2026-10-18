'use client';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useTranslation } from '@/lib/useTranslation';
import { translations } from '@/lib/i18n';
import {
  type ClassInsightsData, type Lang, type StudentInsight, type StudentMeta,
  loadClassInsights, loadStudentMeta, tashkentDate, urgencyCompare,
} from '@/lib/class-insights';

interface Entry {
  key: string;
  day: string; // Tashkent day it was loaded — the 00:05 run makes it stale
  notTeacher: boolean;
  className: string;
  data: ClassInsightsData | null;
  meta: Record<string, StudentMeta>;
}

// Snapshots only change once a night, so moving between the list and a
// student doesn't need to load them again. Kept for this tab's session.
const cache = new Map<string, Entry>();
const cached = (key: string) => {
  const e = cache.get(key);
  return e && e.day === tashkentDate() ? e : null;
};

// Shared by the insights list and the student screen: teacher check, the
// latest snapshot, student names, and the students sorted most urgent first
// (only those still approved in the class).
export function useClassInsights(classId: string) {
  const { user } = useAuth();
  // ?date=YYYY-MM-DD opens a past day's snapshot instead of the latest.
  const dateParam = useSearchParams().get('date');
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : null;
  const query = date ? `?date=${date}` : '';
  const tt = useTranslation();
  const lang: Lang = tt === translations.uz ? 'uz' : 'en';

  const key = `${user?.id ?? ''}|${classId}|${date ?? ''}`;
  const [loaded, setLoaded] = useState<Entry | null>(null);

  useEffect(() => {
    if (!user || !classId || cached(key)) return;
    let cancelled = false;
    (async () => {
      const day = tashkentDate();
      const { data: cls } = await supabase.from('classes').select('teacher_id, name').eq('id', classId).maybeSingle();
      if (cancelled) return;
      if (!cls || cls.teacher_id !== user.id) {
        setLoaded({ key, day, notTeacher: true, className: '', data: null, meta: {} });
        return;
      }
      const [d, m] = await Promise.all([loadClassInsights(classId, date), loadStudentMeta(classId)]);
      if (cancelled) return;
      const entry: Entry = { key, day, notTeacher: false, className: cls.name ?? '', data: d, meta: m };
      // Don't keep "no snapshot yet" — it may appear after tonight's run.
      if (d) cache.set(key, entry);
      setLoaded(entry);
    })();
    return () => { cancelled = true; };
  }, [user, classId, date, key]);

  const entry = cached(key) ?? (loaded?.key === key ? loaded : null);
  const data = entry?.data ?? null;
  const meta = useMemo(() => entry?.meta ?? {}, [entry]);

  const sorted: StudentInsight[] = useMemo(
    () => (data?.rows ?? []).filter(r => meta[r.student_id] !== undefined).sort(urgencyCompare),
    [data, meta],
  );

  const nameOf = (id: string) => meta[id]?.name || tt.classesPage.defaultStudentName;

  return {
    loading: !entry, notTeacher: entry?.notTeacher ?? false, className: entry?.className ?? '',
    data, meta, sorted, lang, nameOf, tt, query,
  };
}
