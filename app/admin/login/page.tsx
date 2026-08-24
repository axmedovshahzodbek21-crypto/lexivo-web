'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function AdminLoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/admin/ielts-builder';

  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setError('Incorrect password.');
        return;
      }
      router.replace(next);
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto px-4 py-24">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <p className="text-[11px] font-black text-[var(--text-muted)] uppercase tracking-[0.15em] mb-1">Admin</p>
        <h1 className="text-2xl font-black text-[var(--text)] mb-5">Sign in</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            className="w-full px-3 py-2.5 rounded-xl text-sm border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
          />
          {error && <p className="text-xs font-bold text-[var(--danger)]">{error}</p>}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-2.5 rounded-xl text-sm font-black text-white transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-light))' }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense>
      <AdminLoginInner />
    </Suspense>
  );
}
