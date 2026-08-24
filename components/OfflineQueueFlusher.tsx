'use client';
import { useEffect } from 'react';
import { initOfflineQueueFlush } from '@/lib/offline-queue';

// Mounted once in the root layout. Registers the 'online' listener that
// replays any writes queued by lib/offline-queue.ts while the browser was
// offline, and makes one flush attempt on load in case items were left over
// from a previous session/tab.
export default function OfflineQueueFlusher() {
  useEffect(() => initOfflineQueueFlush(), []);
  return null;
}
