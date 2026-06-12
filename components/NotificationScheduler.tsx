'use client';
import { useEffect } from 'react';
import { getNotifSettings, scheduleOrShowNotification } from '@/lib/notifications';

export default function NotificationScheduler() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .register('/sw.js')
      .then(() => {
        const settings = getNotifSettings();
        if (settings.enabled && Notification.permission === 'granted') {
          scheduleOrShowNotification(settings);
        }
      })
      .catch(() => {}); // silently fail if SW fails
  }, []);

  return null;
}
