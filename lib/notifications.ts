import { localDateStr } from './storage';

const SETTINGS_KEY = 'lexivo_notif_settings';
const LAST_NOTIF_KEY = 'lexivo_last_notif';

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

// Calculate ms until next occurrence of HH:MM (today or tomorrow)
function msUntil(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  const now = new Date();
  const target = new Date();
  target.setHours(h, m, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target.getTime() - now.getTime();
}

function todayStr(): string {
  return localDateStr();
}

function alreadyNotifiedToday(): boolean {
  return localStorage.getItem(LAST_NOTIF_KEY) === todayStr();
}

function markNotifiedToday() {
  localStorage.setItem(LAST_NOTIF_KEY, todayStr());
}

async function showReminder(reg: ServiceWorkerRegistration) {
  const streak = (() => {
    try { return Number(localStorage.getItem('lexivo_streak') ?? 0); } catch { return 0; }
  })();

  const title = streak > 0 ? `🔥 ${streak}-day streak — keep it going!` : '📚 Time to study!';
  const body = 'Your daily Lexivo session is waiting. A few minutes = a few new words.';

  await reg.showNotification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'lexivo-daily',
    requireInteraction: false,
    data: { url: '/' },
  });

  markNotifiedToday();
}

let scheduledTimer: ReturnType<typeof setTimeout> | null = null;

export async function scheduleOrShowNotification(settings: NotifSettings): Promise<void> {
  if (!settings.enabled) return;
  if (Notification.permission !== 'granted') return;
  if (alreadyNotifiedToday()) return;

  const reg = await navigator.serviceWorker.ready;

  const [h, m] = settings.time.split(':').map(Number);
  const now = new Date();
  const target = new Date();
  target.setHours(h, m, 0, 0);

  if (target.getTime() <= now.getTime()) {
    // Reminder time already passed today and not yet notified — show now
    await showReminder(reg);
  } else {
    // Schedule for later today
    if (scheduledTimer !== null) clearTimeout(scheduledTimer);
    scheduledTimer = setTimeout(async () => {
      if (!alreadyNotifiedToday()) {
        const r = await navigator.serviceWorker.ready;
        await showReminder(r);
      }
    }, msUntil(settings.time));
  }
}

export async function sendTestNotification(): Promise<void> {
  if (Notification.permission !== 'granted') return;
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification('📚 Lexivo test notification', {
    body: 'Notifications are working! You\'ll be reminded at your chosen time.',
    icon: '/icon-192.png',
    tag: 'lexivo-test',
  });
}
