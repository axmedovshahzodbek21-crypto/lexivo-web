'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getUILanguage } from '@/lib/storage';
import { PAGE_TIPS, PAGE_TIPS_UI, getSeenTips, getTipsEnabled, pullTips, markTipSeen, setTipsEnabled } from '@/lib/page-tips';

// For pages whose header is just a heading: <h1>Title <PageTip id="x" inline /></h1>
const INLINE_CLASS = 'inline-flex align-middle ml-2 w-8 h-8 rounded-full items-center justify-center bg-[var(--surface-2)] hover:bg-[var(--border)] transition-colors';

// "?" button for a page header. Also opens the page's tip by itself the first
// time this account lands on the page (see lib/page-tips.ts).
export default function PageTip({ id, className = 'btn-icon', inline = false }: { id: string; className?: string; inline?: boolean }) {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<'en' | 'uz' | 'ru'>('en');
  const userId = user?.id;

  useEffect(() => {
    const update = () => setLang(getUILanguage());
    update();
    window.addEventListener('lexivo-lang-change', update);
    return () => window.removeEventListener('lexivo-lang-change', update);
  }, []);

  useEffect(() => {
    if (loading || getSeenTips().includes(id)) return;
    let cancelled = false;
    (async () => {
      if (userId) { try { await pullTips(userId); } catch {} }
      if (!cancelled && getTipsEnabled() && !getSeenTips().includes(id)) setOpen(true);
    })();
    return () => { cancelled = true; };
  }, [id, loading, userId]);

  const tip = PAGE_TIPS[id]?.[lang];
  if (!tip) return null;
  const ui = PAGE_TIPS_UI[lang];

  const close = () => {
    setOpen(false);
    markTipSeen(id, userId);
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className={inline ? INLINE_CLASS : className} aria-label={ui.showTip}>
        <span className="text-base font-bold text-[var(--text-muted)]">?</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-4 pb-8" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={close}>
          <div className="w-full max-w-md bg-[var(--surface)] rounded-3xl p-6 space-y-5 animate-slide-up text-left" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-[var(--text)]">💡 {tip.title}</h2>
            <div className="space-y-4">
              {tip.steps.map(([icon, title, desc]) => (
                <div key={title} className="flex gap-3">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: 'var(--primary-bg)' }}>{icon}</div>
                  <div>
                    <p className="font-semibold text-sm text-[var(--text)]">{title}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <button onClick={close} className="btn-primary w-full py-3 text-sm rounded-2xl">{ui.gotIt}</button>
              <button
                onClick={() => { setTipsEnabled(false, userId); close(); }}
                className="w-full py-2 text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
              >{ui.turnOff}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
