'use client';
import { useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { pushAll, pullAll } from '@/lib/sync';

const PUSH_INTERVAL_MS = 30_000; // push every 30 seconds

export default function SyncProvider() {
  const { user } = useAuth();
  const pulledRef  = useRef<string | null>(null); // tracks which user we pulled for
  const pushTimer  = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pull on login (once per user session)
  useEffect(() => {
    if (!user || pulledRef.current === user.id) return;
    pulledRef.current = user.id;
    pullAll(user.id).then(() => {
      // Force a page refresh so all components re-read localStorage
      window.dispatchEvent(new Event('lexivo-sync'));
    });
  }, [user]);

  // Push periodically while logged in
  useEffect(() => {
    if (!user) {
      if (pushTimer.current) clearInterval(pushTimer.current);
      return;
    }

    pushTimer.current = setInterval(() => {
      pushAll(user.id);
    }, PUSH_INTERVAL_MS);

    return () => {
      if (pushTimer.current) clearInterval(pushTimer.current);
    };
  }, [user]);

  // Push on page hide (tab close / navigate away)
  useEffect(() => {
    if (!user) return;
    const handler = () => pushAll(user.id);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') handler();
    });
    window.addEventListener('beforeunload', handler);
    return () => {
      document.removeEventListener('visibilitychange', handler);
      window.removeEventListener('beforeunload', handler);
    };
  }, [user]);

  return null;
}
