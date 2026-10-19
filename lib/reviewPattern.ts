// Classifies a student's SRS Review behavior from their timestamped
// class_xp_history entries — shared between the teacher's Review Pattern
// tab (app/classes/[id]/page.tsx) and the per-student XP History panel
// (components/ClassXpHistoryModal.tsx) so both agree on the same labels.
// Label text and blurbs live in i18n (classXpHistory.patternText/Blurb).

export interface ReviewEntry { user_id: string; created_at: string; }

export type ReviewLabel = 'never' | 'daily' | 'mostly' | 'bursty' | 'inactive';

export const REVIEW_LABEL_META: Record<ReviewLabel, { emoji: string; color: string }> = {
  daily:    { emoji: '🟢', color: '#22C55E' },
  mostly:   { emoji: '🟡', color: '#EAB308' },
  bursty:   { emoji: '🟠', color: '#F97316' },
  inactive: { emoji: '🔴', color: '#EF4444' },
  never:    { emoji: '⚪', color: '#94A3B8' },
};

export const REVIEW_WINDOW_DAYS = 30;

const dateKey = (d: Date) => d.toLocaleDateString('en-CA'); // local date, matches class-srs.ts's due-date convention

export function classifyReview(entries: { created_at: string }[], overdueCount: number) {
  const today = new Date();
  const days: string[] = [];
  for (let i = REVIEW_WINDOW_DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(dateKey(d));
  }

  const byDay = new Map<string, number>();
  let lastReviewDate: string | null = null;
  for (const e of entries) {
    const day = dateKey(new Date(e.created_at));
    if (lastReviewDate === null || day > lastReviewDate) lastReviewDate = day;
    if (day >= days[0]) byDay.set(day, (byDay.get(day) ?? 0) + 1);
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
  // Reviews inside the 30-day window only — older ones made "Total reviews
  // (30d)" disagree with "Days reviewed".
  const totalReviews = [...byDay.values()].reduce((a, b) => a + b, 0);
  const avgPerActiveDay = daysReviewed > 0 ? totalReviews / daysReviewed : 0;
  const daysSinceLast = lastReviewDate === null ? null
    : Math.round((new Date(days[days.length - 1]).getTime() - new Date(lastReviewDate).getTime()) / 86400000);

  let label: ReviewLabel;
  if (entries.length === 0) label = 'never';
  else if (coverage >= 0.8) label = 'daily';
  else if (coverage >= 0.4) label = 'mostly';
  else if (daysReviewed <= 2 && overdueCount > 0) label = 'inactive';
  else label = 'bursty';

  return { daysReviewed, coverage, streak, longestGap, totalReviews, avgPerActiveDay, lastReviewDate, daysSinceLast, label };
}
