'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useTranslation } from '@/lib/useTranslation';
import ChatThread from '@/components/ChatThread';

// Student: the conversation with this class's teacher. Teacher notes are
// part of it; writing back needs the teacher to have chat on for the class.
export default function ClassChatPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const tt = useTranslation();
  const t = tt.classChat;
  const [info, setInfo] = useState<{ enabled: boolean; teacherName: string } | null>(null);

  useEffect(() => {
    if (!user || !id) return;
    let cancelled = false;
    (async () => {
      const { data: cls } = await supabase.from('classes').select('*').eq('id', id).maybeSingle();
      if (cancelled || !cls) return;
      const { data: teacher } = await supabase.from('profiles').select('name').eq('id', cls.teacher_id).maybeSingle();
      if (cancelled) return;
      setInfo({
        enabled: Boolean((cls as { chat_enabled?: boolean }).chat_enabled),
        teacherName: (teacher as { name?: string } | null)?.name || tt.classesPage.teacher,
      });
    })();
    return () => { cancelled = true; };
  }, [user, id, tt]);

  if (!user || !info) {
    return <div className="flex justify-center py-16"><div className="text-4xl animate-bounce">💬</div></div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-3 animate-fade-in">
      <h1 className="text-xl font-black text-[var(--text)]">💬 {t.chatWithTeacher}</h1>
      {!info.enabled && <p className="text-xs text-[var(--text-muted)]">{t.offStudent}</p>}
      <ChatThread classId={id} studentId={user.id} as="student" myId={user.id} canSend={info.enabled} otherName={info.teacherName} />
    </div>
  );
}
