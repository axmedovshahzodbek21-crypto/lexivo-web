import { localDateStr, getStreak, getSettings } from './storage';

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

  // 1. Morning Motivation — fixed 8:00 AM
  scheduleAt(8, 0, MORNING_KEY, reg =>
    showNotif(
      reg,
      '📚 Good morning!',
      'Start your day with a few words. A small session now builds big vocabulary later.',
      MORNING_KEY,
      'lexivo-morning',
    ),
  );

  // 2. Streak at Risk — fixed 9:00 PM
  const streakTitle = streak > 0
    ? `🔥 Don't break your ${streak}-day streak!`
    : '🔥 Start your streak today!';
  scheduleAt(21, 0, STREAK_KEY, reg =>
    showNotif(
      reg,
      streakTitle,
      "You haven't studied yet today. 5 minutes is all it takes.",
      STREAK_KEY,
      'lexivo-streak',
    ),
  );

  // 3. Custom Reminder — user-chosen time
  const [h, m] = settings.time.split(':').map(Number);
  scheduleAt(h, m, CUSTOM_KEY, reg =>
    showNotif(
      reg,
      `📖 Time to study, ${name}!`,
      'Your daily Lexivo session is waiting. A few minutes = a few new words.',
      CUSTOM_KEY,
      'lexivo-custom',
    ),
  );
}

export async function sendTestNotification(): Promise<void> {
  if (Notification.permission !== 'granted') return;
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification('📚 Lexivo test notification', {
    body: "Notifications are working! You'll be reminded at your chosen time.",
    icon: '/icon-192.png',
    tag: 'lexivo-test',
  });
}
