'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslation } from '@/lib/useTranslation';
import {
  usePhoneMode, isIOS, isStandalone, shouldSuggestPhoneMode, markPhoneModeSuggested,
} from '@/lib/phone-mode';

// Wraps a study page. In phone mode it becomes a full-screen layer above the
// site nav (see .phone-frame in globals.css); otherwise it's layout-neutral.
// The wrapper element is always rendered so toggling mid-session doesn't
// remount the page's subtree.
export function PhoneStudyFrame({ children }: { children: React.ReactNode }) {
  const [on] = usePhoneMode();

  useEffect(() => {
    if (!on) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [on]);

  return (
    <div className={on ? 'phone-frame' : 'contents'}>
      <div className={on ? 'phone-frame-inner' : 'contents'}>{children}</div>
    </div>
  );
}

// Header button inside each activity. Hidden on desktop-sized screens unless
// phone mode is already on there (so it can always be turned back off).
export function PhoneModeToggle() {
  const t = useTranslation();
  const [on, setOn] = usePhoneMode();
  return (
    <button
      onClick={() => setOn(!on)}
      className={`btn-icon text-base ${on ? '' : 'sm:hidden'}`}
      // Inline, not a utility class: .btn-icon is unlayered CSS and would win over Tailwind's layer.
      style={on ? { background: 'var(--primary)' } : undefined}
      aria-label={on ? t.phoneMode.turnOff : t.phoneMode.turnOn}
      title={on ? t.phoneMode.turnOff : t.phoneMode.turnOn}
    >
      📱
    </button>
  );
}

// Shown only while phone mode is on.
export function PhoneSwipeHint() {
  const t = useTranslation();
  const [on] = usePhoneMode();
  if (!on) return null;
  return <p className="text-center text-xs text-[var(--text-muted)]">{t.phoneMode.swipeHint}</p>;
}

const NO_SUGGEST_PREFIXES = ['/login', '/signup', '/onboarding', '/join', '/update-password', '/reset-password'];

// "Studying on your phone? Try phone mode" — first 5 visits on a phone-sized
// screen, once per visit (rules in lib/phone-mode.ts).
export function PhoneModeSuggest() {
  const t = useTranslation();
  const pathname = usePathname();
  const [, setOn] = usePhoneMode();
  const [visible, setVisible] = useState(false);
  const [justEnabled, setJustEnabled] = useState(false);
  const [showIosTip, setShowIosTip] = useState(false);

  useEffect(() => {
    if (NO_SUGGEST_PREFIXES.some(p => pathname.startsWith(p))) return;
    const timer = setTimeout(() => {
      if (!shouldSuggestPhoneMode()) return;
      markPhoneModeSuggested();
      setShowIosTip(isIOS() && !isStandalone());
      setVisible(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      className="fixed left-3 right-3 z-[70] animate-slide-up"
      style={{ bottom: 'calc(80px + env(safe-area-inset-bottom))' }}
      role="dialog"
      aria-label={t.phoneMode.suggestTitle}
    >
      <div className="card shadow-2xl" style={{ borderTop: '3px solid var(--primary)' }}>
        {justEnabled ? (
          <div className="flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <div className="flex-1">
              <p className="text-sm font-bold text-[var(--text)]">{t.phoneMode.enabled}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{t.phoneMode.changeInSettings}</p>
              {showIosTip && <p className="text-xs text-[var(--text-muted)] mt-1.5">{t.phoneMode.iosTip}</p>}
            </div>
            <button onClick={() => setVisible(false)} className="btn-icon text-sm shrink-0" aria-label={t.phoneMode.later}>✕</button>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <span className="text-2xl">📱</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-[var(--text)]">{t.phoneMode.suggestTitle}</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{t.phoneMode.suggestBody}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => setVisible(false)} className="btn-ghost flex-1 py-2.5 text-sm">{t.phoneMode.later}</button>
              <button onClick={() => { setOn(true); setJustEnabled(true); }} className="btn-primary flex-1 py-2.5 text-sm">{t.phoneMode.enable}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
