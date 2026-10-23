'use client';
import { useEffect, useRef, useState } from 'react';

// Phone mode: the study activities (Review, Learn, Flashcards, Quiz, Match —
// personal and class) render full-screen with no site nav, plus swipe on the
// cards, so the website feels like the app. Mainly for iOS users, who can't
// install the APK.
//
// Device preference, NOT a synced setting: it lives in its own key outside
// lexivo_settings (pullAll would overwrite it otherwise), and turning it on on
// a phone shouldn't turn it on on that user's laptop.
const PHONE_MODE_KEY = 'lexivo_phone_mode';
// How many visits the "try phone mode" suggestion has been shown on.
const PROMPT_COUNT_KEY = 'lexivo_phone_mode_prompts';
// sessionStorage — set once the suggestion has been shown this visit.
const PROMPTED_THIS_VISIT_KEY = 'lexivo_phone_mode_prompted';
const MAX_PROMPTS = 5;
const CHANGE_EVENT = 'lexivo-phone-mode-change';

// Both keys are kept across sign-out by clearUserData (lib/storage.ts) — they
// describe the device, not the account. Keep the two lists in sync.

export function getPhoneMode(): boolean {
  try { return localStorage.getItem(PHONE_MODE_KEY) === 'true'; } catch { return false; }
}

export function setPhoneMode(on: boolean): void {
  try {
    localStorage.setItem(PHONE_MODE_KEY, String(on));
    // Once someone has turned it on they know the feature exists — never suggest it again.
    if (on) localStorage.setItem(PROMPT_COUNT_KEY, String(MAX_PROMPTS));
  } catch {}
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function usePhoneMode(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const update = () => setOn(getPhoneMode());
    update();
    window.addEventListener(CHANGE_EVENT, update);
    return () => window.removeEventListener(CHANGE_EVENT, update);
  }, []);
  return [on, setPhoneMode];
}

// Same cut-off as Tailwind's `sm` breakpoint, where the layout switches from
// the bottom tab bar to the sidebar.
export function isPhoneSized(): boolean {
  return window.matchMedia('(max-width: 639px)').matches;
}

export function isIOS(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

// Opened from the home-screen icon (no Safari address bar).
export function isStandalone(): boolean {
  return (navigator as Navigator & { standalone?: boolean }).standalone === true
    || window.matchMedia('(display-mode: standalone)').matches;
}

// The suggestion shows on phone-sized screens, once per visit, on the first
// MAX_PROMPTS visits, and never once phone mode has been turned on.
export function shouldSuggestPhoneMode(): boolean {
  if (!isPhoneSized() || getPhoneMode()) return false;
  try {
    if (sessionStorage.getItem(PROMPTED_THIS_VISIT_KEY)) return false;
    return (parseInt(localStorage.getItem(PROMPT_COUNT_KEY) ?? '0') || 0) < MAX_PROMPTS;
  } catch { return false; }
}

export function markPhoneModeSuggested(): void {
  try {
    sessionStorage.setItem(PROMPTED_THIS_VISIT_KEY, '1');
    const n = parseInt(localStorage.getItem(PROMPT_COUNT_KEY) ?? '0') || 0;
    localStorage.setItem(PROMPT_COUNT_KEY, String(n + 1));
  } catch {}
}

const SWIPE_THRESHOLD_PX = 80; // same as the app's card drag threshold

// Horizontal card swipe that follows the finger, like the app. Spread
// `handlers` and `style` onto the card. A drag only counts once it's clearly
// sideways, so vertical scrolling of a long card still works.
export function useSwipe({ enabled, onLeft, onRight }: {
  enabled: boolean;
  onLeft?: () => void;
  onRight?: () => void;
}) {
  const start = useRef<{ x: number; y: number; axis: 'x' | 'y' | null } | null>(null);
  const dxRef = useRef(0);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);

  if (!enabled) return { handlers: {}, style: undefined };

  const reset = () => {
    start.current = null;
    dxRef.current = 0;
    setDx(0);
    setDragging(false);
  };

  return {
    handlers: {
      onTouchStart: (e: React.TouchEvent) => {
        const touch = e.touches[0];
        start.current = { x: touch.clientX, y: touch.clientY, axis: null };
      },
      onTouchMove: (e: React.TouchEvent) => {
        const s = start.current;
        if (!s) return;
        const touch = e.touches[0];
        const mx = touch.clientX - s.x;
        const my = touch.clientY - s.y;
        if (!s.axis) {
          if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
          s.axis = Math.abs(mx) > Math.abs(my) ? 'x' : 'y';
          if (s.axis === 'x') setDragging(true);
        }
        if (s.axis === 'x') { dxRef.current = mx; setDx(mx); }
      },
      onTouchEnd: () => {
        const wasX = start.current?.axis === 'x';
        const d = dxRef.current;
        reset();
        if (!wasX) return;
        if (d > SWIPE_THRESHOLD_PX) onRight?.();
        else if (d < -SWIPE_THRESHOLD_PX) onLeft?.();
      },
      onTouchCancel: reset,
    },
    style: {
      transform: dx ? `translateX(${dx}px) rotate(${dx / 30}deg)` : undefined,
      transition: dragging ? 'none' : 'transform 0.2s ease',
      touchAction: 'pan-y',
    } as React.CSSProperties,
  };
}
