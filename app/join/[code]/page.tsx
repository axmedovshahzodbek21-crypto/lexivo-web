'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

interface ClassInfo {
  id: string;
  name: string;
  teacher_id: string;
}

export default function JoinPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [cls, setCls] = useState<ClassInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [status, setStatus] = useState<'idle' | 'joining' | 'joined' | 'already' | 'ownClass'>('idle');

  useEffect(() => {
    if (!code) return;
    supabase
      .from('classes')
      .select('id, name, teacher_id')
      .eq('join_code', code.toUpperCase())
      .single()
      .then(({ data }) => {
        if (!data) setNotFound(true);
        else setCls(data);
      });
  }, [code]);

  useEffect(() => {
    if (!user || !cls || status !== 'idle') return;

    if (cls.teacher_id === user.id) {
      setStatus('ownClass');
      setTimeout(() => router.replace(`/classes/${cls.id}`), 1500);
      return;
    }

    setStatus('joining');
    supabase
      .from('class_members')
      .insert({ class_id: cls.id, student_id: user.id })
      .then(({ error }) => {
        if (error?.code === '23505') setStatus('already');
        else setStatus('joined');
      });
  }, [user, cls]);

  useEffect(() => {
    if (status === 'joined' || status === 'already') {
      const t = setTimeout(() => router.replace('/classes'), 2000);
      return () => clearTimeout(t);
    }
  }, [status]);

  if (notFound) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8 animate-fade-in">
      <div className="text-6xl">❓</div>
      <p className="text-xl font-bold text-[var(--text)]">Class not found</p>
      <p className="text-sm text-[var(--text-muted)]">This invite link may be invalid or the class was deleted.</p>
      <button onClick={() => router.push('/classes')} className="btn-primary">Go to Classes</button>
    </div>
  );

  if (!cls) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-5xl animate-bounce">🎓</div>
    </div>
  );

  if (status === 'joined') return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8 animate-fade-in">
      <div className="text-6xl">🎉</div>
      <p className="text-2xl font-black text-[var(--text)]">You joined!</p>
      <p className="text-[var(--text-muted)]">{cls.name}</p>
      <p className="text-sm text-[var(--text-muted)]">Redirecting…</p>
    </div>
  );

  if (status === 'already') return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8 animate-fade-in">
      <div className="text-6xl">✅</div>
      <p className="text-2xl font-black text-[var(--text)]">Already a member</p>
      <p className="text-[var(--text-muted)]">{cls.name}</p>
      <p className="text-sm text-[var(--text-muted)]">Redirecting…</p>
    </div>
  );

  if (status === 'ownClass') return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8 animate-fade-in">
      <div className="text-6xl">👩‍🏫</div>
      <p className="text-xl font-bold text-[var(--text)]">That's your class!</p>
      <p className="text-sm text-[var(--text-muted)]">Opening dashboard…</p>
    </div>
  );

  if (status === 'joining') return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8 animate-fade-in">
      <div className="text-5xl animate-bounce">🎓</div>
      <p className="font-bold text-[var(--text)]">Joining {cls.name}…</p>
    </div>
  );

  // Not logged in
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-8 animate-fade-in">
      <div className="text-6xl">🎓</div>
      <div className="text-center space-y-1">
        <p className="text-sm text-[var(--text-muted)]">You&apos;ve been invited to join</p>
        <p className="text-2xl font-black text-[var(--text)]">{cls.name}</p>
      </div>
      <div className="w-full max-w-xs space-y-4">
        <button
          onClick={() => router.push(`/login?redirect=/join/${code}`)}
          className="btn-primary w-full py-3.5 text-base"
        >
          Sign in to join →
        </button>
        <p className="text-center text-xs text-[var(--text-muted)]">
          Or enter code{' '}
          <code className="font-bold text-[var(--primary)]">{code?.toUpperCase()}</code>
          {' '}manually on the Classes page
        </p>
      </div>
    </div>
  );
}
