'use client';
import { useTranslation } from '@/lib/useTranslation';
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
  const t = useTranslation();
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [cls, setCls] = useState<ClassInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [status, setStatus] = useState<'idle' | 'joining' | 'joined' | 'pending' | 'already' | 'ownClass' | 'joinError'>('idle');

  useEffect(() => {
    if (!code) return;
    setNotFound(false);
    setFetchError(false);
    // Guards against a slow stale request (e.g. from a previous retryKey,
    // or a fast navigation between two different join links) resolving
    // after a faster, more recent one and overwriting this page's state.
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('classes')
          .select('id, name, teacher_id')
          .eq('join_code', code.toUpperCase())
          .single();
        if (cancelled) return;
        if (data) { setCls(data); return; }
        // PGRST116 = "no rows" from .single() — a genuinely bad code.
        // Anything else (network failure, outage) is not the same as
        // "invalid link" and shouldn't be shown as one.
        if (error && error.code !== 'PGRST116') { setFetchError(true); return; }
        setNotFound(true);
      } catch {
        if (!cancelled) setFetchError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [code, retryKey]);

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
      .insert({ class_id: cls.id, student_id: user.id, status: 'pending' })
      .then(({ error }) => {
        // Only 23505 (unique violation) means the insert didn't happen
        // because a row already exists — every other error (RLS denial,
        // network failure) meant no row was created either, but was
        // falling through to the same 'joined' success state and showing
        // "🎉 You joined!" regardless.
        if (error?.code === '23505') setStatus('already');
        else if (error) setStatus('joinError');
        else setStatus('pending');
      });
  }, [user, cls, status, router]);

  useEffect(() => {
    if (status === 'joined' || status === 'already' || status === 'pending') {
      const t = setTimeout(() => router.replace('/classes'), 2000);
      return () => clearTimeout(t);
    }
  }, [status]);

  if (fetchError) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8 animate-fade-in">
      <div className="text-6xl">⚠️</div>
      <p className="text-xl font-bold text-[var(--text)]">Couldn&#39;t load this invite</p>
      <p className="text-sm text-[var(--text-muted)]">{t.joinPage.checkFailed}</p>
      <button onClick={() => setRetryKey(k => k + 1)} className="btn-primary">{t.joinPage.tryAgain}</button>
    </div>
  );

  if (notFound) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8 animate-fade-in">
      <div className="text-6xl">❓</div>
      <p className="text-xl font-bold text-[var(--text)]">{t.joinPage.classNotFound}</p>
      <p className="text-sm text-[var(--text-muted)]">{t.joinPage.inviteInvalid}</p>
      <button onClick={() => router.push('/classes')} className="btn-primary">{t.joinPage.goToClasses}</button>
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
      <p className="text-2xl font-black text-[var(--text)]">{t.joinPage.youJoined}</p>
      <p className="text-[var(--text-muted)]">{cls.name}</p>
      <p className="text-sm text-[var(--text-muted)]">Redirecting…</p>
    </div>
  );

  if (status === 'pending') return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8 animate-fade-in">
      <div className="text-6xl">⏳</div>
      <p className="text-2xl font-black text-[var(--text)]">{t.joinPage.requestSent}</p>
      <p className="text-[var(--text-muted)]">Waiting for your teacher to approve you into {cls.name}</p>
      <p className="text-sm text-[var(--text-muted)]">Redirecting…</p>
    </div>
  );

  if (status === 'already') return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8 animate-fade-in">
      <div className="text-6xl">✅</div>
      <p className="text-2xl font-black text-[var(--text)]">{t.joinPage.alreadyMember}</p>
      <p className="text-[var(--text-muted)]">{cls.name}</p>
      <p className="text-sm text-[var(--text-muted)]">Redirecting…</p>
    </div>
  );

  if (status === 'joinError') return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8 animate-fade-in">
      <div className="text-6xl">⚠️</div>
      <p className="text-xl font-bold text-[var(--text)]">Couldn&apos;t join {cls.name}</p>
      <p className="text-sm text-[var(--text-muted)]">{t.joinPage.somethingWrong}</p>
      <button onClick={() => setStatus('idle')} className="btn-primary">{t.joinPage.tryAgain}</button>
    </div>
  );

  if (status === 'ownClass') return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8 animate-fade-in">
      <div className="text-6xl">👩‍🏫</div>
      <p className="text-xl font-bold text-[var(--text)]">{t.joinPage.thatsYourClass}</p>
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
