'use client';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { pushAll } from '@/lib/web-sync';

// Periodic sync is handled by startSync in auth-context (web-sync.ts).
// This component only adds tab-close/hide push and SW-update auto-reload.
export default function SyncProvider() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const visHandler = () => { if (document.visibilityState === 'hidden') pushAll(user.id); };
    const unloadHandler = () => pushAll(user.id);
    document.addEventListener('visibilitychange', visHandler);
    window.addEventListener('beforeunload', unloadHandler);
    return () => {
      document.removeEventListener('visibilitychange', visHandler);
      window.removeEventListener('beforeunload', unloadHandler);
    };
  }, [user]);

  // Auto-reload when a new service worker takes control so stale JS never runs sync.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onControllerChange = () => window.location.reload();
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
  }, []);

  return null;
}
