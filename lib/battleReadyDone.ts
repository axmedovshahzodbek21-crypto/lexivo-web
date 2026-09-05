'use client';

// Tracks which Battle-Ready topics the user has manually marked "Done",
// mirroring the VISITED_KEY pattern in app/reading/page.tsx (localStorage
// set of ids). Used so "Surprise Me" can skip topics already finished.

const DONE_KEY = 'lexivo_battle_ready_done';

export function getDoneTopics(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    return new Set(JSON.parse(window.localStorage.getItem(DONE_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

function save(set: Set<string>) {
  window.localStorage.setItem(DONE_KEY, JSON.stringify([...set]));
}

export function isTopicDone(slug: string): boolean {
  return getDoneTopics().has(slug);
}

export function markTopicDone(slug: string) {
  const set = getDoneTopics();
  set.add(slug);
  save(set);
}

export function markTopicNotDone(slug: string) {
  const set = getDoneTopics();
  set.delete(slug);
  save(set);
}

export function toggleTopicDone(slug: string): boolean {
  const set = getDoneTopics();
  const next = !set.has(slug);
  if (next) set.add(slug); else set.delete(slug);
  save(set);
  return next;
}
