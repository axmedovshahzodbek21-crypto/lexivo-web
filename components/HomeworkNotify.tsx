'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { localDateStr, addDaysToDateStr } from '@/lib/storage';

interface HWToast { id: string; title: string; dueDate: string | null; className: string; }

function dueText(due: string | null): { label: string; urgent: boolean } {
  if (!due) return { label: 'No deadline set', urgent: false };
  const today = localDateStr();
  const tomorrow = addDaysToDateStr(today, 1);
  if (due < today) return { label: `Overdue · ${due}`, urgent: true };
  if (due === today) return { label: 'Due today', urgent: true };
  if (due === tomorrow) return { label: 'Due tomorrow', urgent: false };
  return { label: `Due ${due}`, urgent: false };
}

export default function HomeworkNotify() {
  const { user } = useAuth();
  const [toasts, setToasts] = useState<HWToast[]>([]);
  const classNames = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!user) return;

    // Pre-fetch joined class names
    (async () => {
      const { data: memberships } = await supabase
        .from('class_members').select('class_id').eq('student_id', user.id);
      if (!memberships?.length) return;
      const ids = memberships.map((m: { class_id: string }) => m.class_id);
      const { data: classes } = await supabase
        .from('classes').select('id, name, teacher_id').in('id', ids);
      for (const c of classes ?? []) {
        if (c.teacher_id !== user.id) classNames.current.set(c.id, c.name);
      }
    })();

    // Subscribe to new targets assigned to this student
    const channel = supabase.channel(`hw-notify-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'class_targets', filter: `student_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as { id: string; class_id: string; title: string; due_date: string | null };
          const className = classNames.current.get(row.class_id) ?? 'Class';
          const toast: HWToast = { id: row.id, title: row.title, dueDate: row.due_date, className };
          setToasts(prev => [...prev, toast]);
          setTimeout(() => setToasts(prev => prev.filter(x => x.id !== toast.id)), 8000);
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 'min(360px, calc(100vw - 2rem))' }}>
      {toasts.map(t => {
        const { label, urgent } = dueText(t.dueDate);
        return (
          <div key={t.id} className="pointer-events-auto flex items-start gap-3 bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-4 shadow-xl animate-fade-in"
            style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <div className="w-10 h-10 rounded-xl bg-[var(--primary-bg)] flex items-center justify-center shrink-0 text-xl">📋</div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--primary)] mb-0.5">{t.className}</p>
              <p className="text-sm font-bold text-[var(--text)] leading-snug">New homework assigned</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{t.title}</p>
              <p className={`text-xs font-semibold mt-1 ${urgent ? 'text-red-500' : 'text-[var(--text-muted)]'}`}>{label}</p>
            </div>
            <button
              onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
              className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors text-sm leading-none mt-0.5"
              aria-label="Dismiss"
            >✕</button>
          </div>
        );
      })}
    </div>
  );
}
