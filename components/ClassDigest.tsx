'use client';
import { useState } from 'react';
import { useTranslation } from '@/lib/useTranslation';
import { translations } from '@/lib/i18n';
import { loadClassDigest } from '@/lib/class-digest-load';
import type { ClassDigest as Digest } from '@/lib/class-digest';
import StudentSummary from './StudentSummary';

// The teacher's weekly class digest: rule-based, built on request.
export default function ClassDigest({ classId, students }: {
  classId: string;
  students: { id: string; name: string }[];
}) {
  const tt = useTranslation();
  const t = tt.classesPage;
  const [digest, setDigest] = useState<Digest | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const generate = async () => {
    setLoading(true);
    setFailed(false);
    try {
      setDigest(await loadClassDigest(classId, students, tt === translations.uz ? 'uz' : 'en', tt));
    } catch (e) {
      console.error('[class digest]', e);
      setFailed(true);
    }
    setLoading(false);
  };

  return (
    <div>
      <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide mb-2">{t.aiWeeklyDigest}</p>
      <div className="card space-y-3">
        <p className="text-xs text-[var(--text-muted)]">{t.aiDigestSub}</p>
        <button onClick={generate} disabled={loading} className="w-full btn-primary py-3 disabled:opacity-50">
          {loading ? t.generatingDigest : t.generateDigest}
        </button>
        {failed && <p className="text-xs" style={{ color: 'var(--danger)' }}>{t.errorGeneratingDigest}</p>}
        {digest && !failed && (
          <div className="bg-[var(--surface-2)] rounded-xl p-3 animate-fade-in">
            <StudentSummary sentences={digest.main} more={digest.more} classId={classId} accentColor="var(--primary)" reasonLabel={r => r} />
          </div>
        )}
      </div>
    </div>
  );
}
