'use client';
import { useEffect, startTransition } from 'react';
import { useAppStore } from '@/lib/store';
import { loadAllCollections } from '@/lib/data';

export default function DataLoader() {
  const { collectionsLoaded, setCollections } = useAppStore();

  useEffect(() => {
    if (collectionsLoaded) return;
    loadAllCollections().then(data => {
      startTransition(() => setCollections(data));
    }).catch(console.error);
  }, [collectionsLoaded, setCollections]);

  return null;
}
