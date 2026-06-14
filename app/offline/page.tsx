'use client';
import Link from 'next/link';
import { useTranslation } from '@/lib/useTranslation';

export default function OfflinePage() {
  const t = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center gap-6">
      <div className="text-6xl">📵</div>
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)] mb-2">{t.common.offlineTitle}</h1>
        <p className="text-[var(--text-muted)] text-sm leading-relaxed">{t.common.offlineBody}</p>
      </div>
      <Link href="/" className="btn-primary px-8 py-3">{t.common.tryAgain}</Link>
    </div>
  );
}
