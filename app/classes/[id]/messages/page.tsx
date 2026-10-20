'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useTranslation } from '@/lib/useTranslation';
import { type StudentMeta, loadStudentMeta } from '@/lib/class-insights';
import { type InboxEntry, loadInbox, pollWhileVisible, setChatEnabled } from '@/lib/class-chat';
import ChatThread from '@/components/ChatThread';

// Teacher: every student's conversation, the class's chat on/off switch,
// and one conversation at a time (?s=<studentId>). The teacher can always
// write (that's a teacher note); students can only write back when chat is on.
export default function ClassMessagesPage() {
  const { id } = useParams<{ id: string }>();
  const selected = useSearchParams().get('s');
  const { user } = useAuth();
  const tt = useTranslation();
  const t = tt.classChat;

  const [loading, setLoading] = useState(true);
  const [notTeacher, setNotTeacher] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [students, setStudents] = useState<Record<string, StudentMeta>>({});
  const [inbox, setInbox] = useState<Record<string, InboxEntry>>({});

  useEffect(() => {
    if (!user || !id) return;
    let cancelled = false;
    (async () => {
      const { data: cls } = await supabase.from('classes').select('*').eq('id', id).maybeSingle();
      if (cancelled) return;
      if (!cls || cls.teacher_id !== user.id) { setNotTeacher(true); setLoading(false); return; }
      setEnabled(Boolean((cls as { chat_enabled?: boolean }).chat_enabled));
      const [meta, box] = await Promise.all([loadStudentMeta(id), loadInbox(id)]);
      if (cancelled) return;
      setStudents(meta);
      setInbox(box);
      setLoading(false);
    })();
    const stop = pollWhileVisible(() => { loadInbox(id).then(box => { if (!cancelled) setInbox(box); }); }, 30_000);
    return () => { cancelled = true; stop(); };
  }, [user, id, selected]);

  if (loading) {
    return <div className="flex justify-center py-16"><div className="text-4xl animate-bounce">💬</div></div>;
  }
  if (notTeacher || !user) {
    return <p className="p-8 text-center text-[var(--text-muted)]">{tt.classesPage.onlyTeacherDashboard}</p>;
  }

  const toggle = async () => {
    setToggling(true);
    if (await setChatEnabled(id, !enabled)) setEnabled(!enabled);
    setToggling(false);
  };
  const nameOf = (sid: string) => students[sid]?.name || tt.classesPage.defaultStudentName;

  if (selected && students[selected]) {
    return (
      <div className="max-w-3xl mx-auto p-4 space-y-3 animate-fade-in">
        <Link href={`/classes/${id}/messages`} className="text-sm font-semibold text-[var(--primary)]">← {t.back}</Link>
        <h1 className="text-xl font-black text-[var(--text)]">💬 {nameOf(selected)}</h1>
        {!enabled && <p className="text-xs text-[var(--text-muted)]">{t.offHint}</p>}
        <ChatThread classId={id} studentId={selected} as="teacher" myId={user.id} canSend otherName={nameOf(selected)} />
      </div>
    );
  }

  const ids = Object.keys(students).sort((a, b) =>
    (inbox[b]?.unread ?? 0) - (inbox[a]?.unread ?? 0)
    || (inbox[b]?.last?.created_at ?? '').localeCompare(inbox[a]?.last?.created_at ?? '')
    || nameOf(a).localeCompare(nameOf(b)));

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4 animate-fade-in">
      <h1 className="text-2xl font-black text-[var(--text)]">💬 {t.title}</h1>

      <div className="card flex items-center justify-between gap-3 flex-wrap" style={{ padding: 14 }}>
        <div className="min-w-0">
          <p className="text-sm font-bold" style={{ color: enabled ? 'var(--success)' : 'var(--text)' }}>{enabled ? t.enabled : t.disabled}</p>
          {!enabled && <p className="text-xs text-[var(--text-muted)] mt-0.5">{t.offHint}</p>}
        </div>
        <button
          type="button"
          onClick={() => void toggle()}
          disabled={toggling}
          className="text-sm font-bold px-4 py-2 rounded-xl disabled:opacity-50"
          style={enabled
            ? { background: 'var(--surface-2)', color: 'var(--text)' }
            : { background: 'var(--primary)', color: '#fff' }}
        >
          {enabled ? t.turnOff : t.turnOn}
        </button>
      </div>

      {ids.length === 0 ? (
        <div className="card"><p className="text-sm text-[var(--text-muted)]">{t.noStudents}</p></div>
      ) : (
        <ul className="card divide-y divide-[var(--border)]" style={{ padding: 0 }}>
          {ids.map(sid => {
            const e = inbox[sid];
            return (
              <li key={sid}>
                <Link href={`/classes/${id}/messages?s=${sid}`} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface-2)] transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className={`text-[var(--text)] truncate ${e?.unread ? 'font-black' : 'font-bold'}`}>{nameOf(sid)}</p>
                    {e?.last && (
                      <p className="text-sm text-[var(--text-muted)] truncate">
                        {e.last.from === 'teacher' ? `${t.you}: ` : ''}{e.last.message}
                      </p>
                    )}
                  </div>
                  {(e?.unread ?? 0) > 0 && (
                    <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center">{e!.unread}</span>
                  )}
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
