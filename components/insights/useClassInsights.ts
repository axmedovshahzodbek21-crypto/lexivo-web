'use client';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useTranslation } from '@/lib/useTranslation';
import { translations } from '@/lib/i18n';
import {
  type ClassInsightsData, type Lang, type StudentInsight, type StudentMeta,
  loadClassInsights, loadStudentMeta, urgencyCompare,
} from '@/lib/class-insights';

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

  const [loading, setLoading] = useState(true);
  const [notTeacher, setNotTeacher] = useState(false);
  const [className, setClassName] = useState('');
  const [data, setData] = useState<ClassInsightsData | null>(null);
  const [meta, setMeta] = useState<Record<string, StudentMeta>>({});

  useEffect(() => {
    if (!user || !classId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: cls } = await supabase.from('classes').select('teacher_id, name').eq('id', classId).maybeSingle();
      if (cancelled) return;
      if (!cls || cls.teacher_id !== user.id) { setNotTeacher(true); setLoading(false); return; }
      setClassName(cls.name ?? '');
      const [d, m] = await Promise.all([loadClassInsights(classId, date), loadStudentMeta(classId)]);
      if (cancelled) return;
      setData(d);
      setMeta(m);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, classId, date]);

  const sorted: StudentInsight[] = useMemo(
    () => (data?.rows ?? []).filter(r => meta[r.student_id] !== undefined).sort(urgencyCompare),
    [data, meta],
  );

  const nameOf = (id: string) => meta[id]?.name || tt.classesPage.defaultStudentName;

  return { loading, notTeacher, className, data, meta, sorted, lang, nameOf, tt, query };
}
