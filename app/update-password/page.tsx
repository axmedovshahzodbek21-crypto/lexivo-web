'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword]   = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [done, setDone]           = useState(false);
  const [ready, setReady]         = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setReady(true);
      } else {
        router.replace('/login');
      }
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== password2) { setError('Passwords do not match.'); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setDone(true);
    setTimeout(() => router.replace('/'), 2000);
  };

  if (!ready) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="text-[var(--text-muted)]">Loading…</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-[var(--background)] flex items-center justify-center px-5">
      <div className="w-full max-w-sm animate-depth-in">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🔒</div>
          <h1 className="text-3xl font-black" style={{ color: 'var(--primary)' }}>New Password</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Choose a new password for your account</p>
        </div>

        {done ? (
          <div className="px-4 py-4 rounded-2xl text-center font-semibold" style={{ background: 'rgba(46,204,113,0.1)', color: 'var(--primary)' }}>
            Password updated! Redirecting…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5 uppercase tracking-wide">
                New Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                required
                autoFocus
                className="w-full px-4 py-3.5 rounded-2xl border-2 border-[var(--border)] bg-[var(--surface)] text-[var(--text)] outline-none transition-colors focus:border-[var(--primary)] text-base"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5 uppercase tracking-wide">
                Confirm Password
              </label>
              <input
                type="password"
                value={password2}
                onChange={e => setPassword2(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3.5 rounded-2xl border-2 border-[var(--border)] bg-[var(--surface)] text-[var(--text)] outline-none transition-colors focus:border-[var(--primary)] text-base"
              />
            </div>

            {error && (
              <div className="px-4 py-3 rounded-2xl text-sm font-medium" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-4 text-base font-bold disabled:opacity-60"
            >
              {loading ? 'Saving…' : 'Set New Password →'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
