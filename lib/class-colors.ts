'use client';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { CLASS_COLORS, DEFAULT_CLASS_COLOR, type ClassColorKey } from '@/lib/class-gradient';

type Choices = Record<string, ClassColorKey>;

const NONE: Choices = {};
let choices = NONE;
let loadedFor: string | null = null;
const listeners = new Set<() => void>();

const cacheKey = (userId: string) => `lexivo_class_colors_${userId}`;

function setChoices(next: Choices, userId: string | null) {
  choices = next;
  if (userId) {
    try { localStorage.setItem(cacheKey(userId), JSON.stringify(next)); } catch { /* storage full or blocked */ }
  }
  listeners.forEach(l => l());
}

async function load(userId: string | null) {
  loadedFor = userId;
  if (!userId) { setChoices(NONE, null); return; }
  // Show the saved colours straight away, so a reload doesn't flash the default.
  try { setChoices(JSON.parse(localStorage.getItem(cacheKey(userId)) ?? '{}'), userId); } catch { setChoices(NONE, userId); }
  const { data, error } = await supabase.from('class_colors').select('class_id, color');
  if (error) { console.error('[class-colors]', error); return; }
  if (loadedFor !== userId) return; // signed into another account meanwhile
  setChoices(Object.fromEntries(data.map(r => [r.class_id, r.color as ClassColorKey])), userId);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Returns a lookup from class id to the signed-in person's colour for that class. */
export function useClassColors() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  useEffect(() => {
    if (userId !== loadedFor) void load(userId);
  }, [userId]);
  const current = useSyncExternalStore(subscribe, () => choices, () => NONE);
  return useCallback(
    (classId: string) => CLASS_COLORS[current[classId] ?? DEFAULT_CLASS_COLOR] ?? CLASS_COLORS[DEFAULT_CLASS_COLOR],
    [current],
  );
}

/** Saves the colour for this person only. Resolves false, and undoes it, if the save fails. */
export async function saveClassColor(userId: string, classId: string, color: ClassColorKey): Promise<boolean> {
  const previous = choices;
  setChoices({ ...previous, [classId]: color }, userId);
  const { error } = await supabase
    .from('class_colors')
    .upsert({ user_id: userId, class_id: classId, color }, { onConflict: 'user_id,class_id' });
  if (error) {
    console.error('[class-colors]', error);
    setChoices(previous, userId);
    return false;
  }
  return true;
}
