import { localDateStr, getStreak, getSettings, getUILanguage } from './storage';
import { translations } from './i18n';

const SETTINGS_KEY = 'lexivo_notif_settings';
const MORNING_KEY  = 'lexivo_last_notif_morning';
const STREAK_KEY   = 'lexivo_last_notif_streak';
const CUSTOM_KEY   = 'lexivo_last_notif_custom';

export interface NotifSettings {
  enabled: boolean;
  time: string; // "HH:MM" 24-hour
}

export function getNotifSettings(): NotifSettings {
  if (typeof window === 'undefined') return { enabled: false, time: '20:00' };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw) as NotifSettings;
  } catch {}
  return { enabled: false, time: '20:00' };
}

export function saveNotifSettings(s: NotifSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function isNotifSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
}

export function getNotifPermission(): NotificationPermission | 'unsupported' {
  if (!isNotifSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestNotifPermission(): Promise<NotificationPermission> {
  if (!isNotifSupported()) return 'denied';
  return Notification.requestPermission();
}

function todayStr(): string {
  return localDateStr();
}

function notifiedToday(key: string): boolean {
  return localStorage.getItem(key) === todayStr();
}

function markNotified(key: string) {
  localStorage.setItem(key, todayStr());
}

async function showNotif(
  reg: ServiceWorkerRegistration,
  title: string,
  body: string,
  key: string,
  tag: string,
) {
  await reg.showNotification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag,
    requireInteraction: false,
    data: { url: '/' },
  });
  markNotified(key);
}

let scheduledTimers: ReturnType<typeof setTimeout>[] = [];

function scheduleAt(
  h: number,
  m: number,
  key: string,
  showFn: (reg: ServiceWorkerRegistration) => Promise<void>,
) {
  if (notifiedToday(key)) return;

  const now = new Date();
  const target = new Date();
  target.setHours(h, m, 0, 0);

  if (target.getTime() <= now.getTime()) {
    // Time already passed today — show immediately
    navigator.serviceWorker.ready.then(reg => showFn(reg));
  } else {
    const timer = setTimeout(async () => {
      if (!notifiedToday(key)) {
        const r = await navigator.serviceWorker.ready;
        await showFn(r);
      }
    }, target.getTime() - now.getTime());
    scheduledTimers.push(timer);
  }
}

export async function scheduleOrShowNotification(settings: NotifSettings): Promise<void> {
  if (!settings.enabled) return;
  if (Notification.permission !== 'granted') return;

  // Clear any previously scheduled timers
  scheduledTimers.forEach(t => clearTimeout(t));
  scheduledTimers = [];

  const streak = getStreak();
  const name = (getSettings().name ?? '').trim() || 'Learner';
  const t = translations[getUILanguage()];

  // 1. Morning Motivation — fixed 8:00 AM
  scheduleAt(8, 0, MORNING_KEY, reg =>
    showNotif(
      reg,
      t.settings.pushMorningTitle,
      t.settings.pushMorningBody,
      MORNING_KEY,
      'lexivo-morning',
    ),
  );

  // 2. Streak at Risk — fixed 9:00 PM
  const streakTitle = streak > 0
    ? t.settings.pushStreakTitleActive(streak)
    : t.settings.pushStreakTitleInactive;
  scheduleAt(21, 0, STREAK_KEY, reg =>
    showNotif(
      reg,
      streakTitle,
      t.settings.pushStreakBody,
      STREAK_KEY,
      'lexivo-streak',
    ),
  );

  // 3. Custom Reminder — user-chosen time
  const [h, m] = settings.time.split(':').map(Number);
  scheduleAt(h, m, CUSTOM_KEY, reg =>
    showNotif(
      reg,
      t.settings.pushCustomTitle(name),
      t.settings.pushCustomBody,
      CUSTOM_KEY,
      'lexivo-custom',
    ),
  );
}

export async function sendTestNotification(): Promise<void> {
  if (Notification.permission !== 'granted') return;
  const reg = await navigator.serviceWorker.ready;
  const t = translations[getUILanguage()];
  await reg.showNotification(t.settings.pushTestTitle, {
    body: t.settings.pushTestBody,
    icon: '/icon-192.png',
    tag: 'lexivo-test',
  });
}
