'use client';
import Link from 'next/link';

export default function OfflinePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center gap-6">
      <div className="text-6xl">📵</div>
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)] mb-2">You're offline</h1>
        <p className="text-[var(--text-muted)] text-sm leading-relaxed">
          No internet connection. Your progress and learned words are saved — you can keep studying once you're back online.
        </p>
      </div>
      <Link href="/" className="btn-primary px-8 py-3">
        Try again
      </Link>
    </div>
  );
}
