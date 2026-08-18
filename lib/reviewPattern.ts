// Classifies a student's SRS Review behavior from their timestamped
// class_xp_history entries — shared between the teacher's Review Pattern
// tab (app/classes/[id]/page.tsx) and the per-student XP History panel
// (components/ClassXpHistoryModal.tsx) so both agree on the same labels.

export interface ReviewEntry { user_id: string; created_at: string; }

export type ReviewLabel = 'never' | 'daily' | 'mostly' | 'bursty' | 'inactive';

export const REVIEW_LABEL_META: Record<ReviewLabel, { emoji: string; text: string; color: string; blurb: string }> = {
  daily:    { emoji: '🟢', text: 'Daily',          color: '#22C55E', blurb: 'Reviews on nearly every day — small, steady sessions.' },
  mostly:   { emoji: '🟡', text: 'Mostly daily',    color: '#EAB308', blurb: 'Reviews most days, with the occasional gap.' },
  bursty:   { emoji: '🟠', text: 'Bursty catch-up', color: '#F97316', blurb: 'Reviews rarely, but does a lot at once when they do.' },
  inactive: { emoji: '🔴', text: 'Inactive',        color: '#EF4444', blurb: 'Little to no review activity, and words are piling up.' },
  never:    { emoji: '⚪', text: 'Never reviewed',  color: '#94A3B8', blurb: "Hasn't done a single SRS review yet." },
};

export const REVIEW_WINDOW_DAYS = 30;

export function classifyReview(entries: { created_at: string }[], overdueCount: number) {
  const today = new Date();
  const dateKey = (d: Date) => d.toISOString().slice(0, 10);
  const byDay = new Map<string, number>();
  for (const e of entries) {
    const day = e.created_at.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  const days: string[] = [];
  for (let i = REVIEW_WINDOW_DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(dateKey(d));
  }
  const daysReviewed = days.filter(d => byDay.has(d)).length;
  const coverage = daysReviewed / REVIEW_WINDOW_DAYS;

  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (byDay.has(days[i])) streak++; else break;
  }
  let longestGap = 0, curGap = 0;
  for (const d of days) {
    if (byDay.has(d)) curGap = 0;
    else { curGap++; longestGap = Math.max(longestGap, curGap); }
  }
  const totalReviews = entries.length;
  const avgPerActiveDay = daysReviewed > 0 ? totalReviews / daysReviewed : 0;

  let label: ReviewLabel;
  if (totalReviews === 0) label = 'never';
  else if (coverage >= 0.8) label = 'daily';
  else if (coverage >= 0.4) label = 'mostly';
  else if (daysReviewed <= 2 && overdueCount > 0) label = 'inactive';
  else label = 'bursty';

  return { daysReviewed, coverage, streak, longestGap, totalReviews, avgPerActiveDay, label };
}
