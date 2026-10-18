// Smart insights: loading the nightly snapshots and turning saved sentence
// templates into text + clickable pieces. Everything shown is read from rows
// run_daily_class_insights saved (supabase/migrations/2026101700000*), so a
// teacher sees the same paragraph all day.
import { supabase } from '@/lib/supabase';
import { readingPassages } from '@/lib/reading-data';

export type Lang = 'uz' | 'en';

export interface LearnTask {
  homework_id: string;
  due_date: string;
  unit_name: string | null;
  collection_name: string | null;
  day_number: number | null;
  passage_id: number | null;
  completed_at: string | null;
  status: 'done' | 'late' | 'open';
}

export interface ReviewDay {
  date: string;
  due_count: number;
  remaining_count: number;
  words: string[];
  remaining_words: string[];
  status: 'done' | 'missed';
}

export interface WeekTasks { learn: LearnTask[]; review: ReviewDay[]; }

export interface DayInfo {
  date: string;
  before_join: boolean;
  learn_due?: number;
  learn_done?: number;
  learn_late?: number;
  learn_open?: number;
  review_due?: boolean;
  review_done?: boolean;
  missed?: boolean;
  active?: boolean;
}

export interface ParagraphPart { part: string; pattern: string; template_id: number | null; }

export interface StudentInsight {
  student_id: string;
  snapshot_date: string;
  kind: 'skipper' | 'level' | 'neutral';
  level: number | null;
  trend: 'rising' | 'steady' | 'falling' | null;
  score: number | null;
  done: number;
  total: number;
  prev_score: number | null;
  days_skipped: number;
  window_start: string;
  days: DayInfo[] | null;
  tasks: { this_week: WeekTasks; last_week: WeekTasks } | null;
  patterns: string[];
  hard_words: { own: string[]; shared: string[] } | null;
  paragraph: ParagraphPart[] | null;
}

export interface ClassInsight {
  snapshot_date: string;
  student_count: number;
  attention_count: number;
  hard_words: { word: string; students: number }[];
  summary_template_id: number | null;
  behind_template_id: number | null;
  well_template_id: number | null;
  hard_template_id: number | null;
  skipper_template_id: number | null;
}

export interface Template { id: number; text_uz: string; text_en: string | null; }

export interface StudentMeta { name: string; avatar_url: string | null; }

export interface ClassInsightsData {
  classRow: ClassInsight;
  rows: StudentInsight[];
  templates: Record<number, Template>;
}

const STUDENT_COLUMNS =
  'student_id, snapshot_date, kind, level, trend, score, done, total, prev_score, days_skipped, window_start, days, tasks, patterns, hard_words, paragraph';

// Latest saved day for the class — not strictly "today", so the page still
// works in the minutes before the 00:05 run — or a given past day (?date=).
// Null if there is no snapshot.
export async function loadClassInsights(classId: string, date?: string | null): Promise<ClassInsightsData | null> {
  let query = supabase
    .from('class_insight_class_snapshots')
    .select('snapshot_date, student_count, attention_count, hard_words, summary_template_id, behind_template_id, well_template_id, hard_template_id, skipper_template_id')
    .eq('class_id', classId);
  query = date ? query.eq('snapshot_date', date) : query.order('snapshot_date', { ascending: false });
  const { data: cls } = await query.limit(1).maybeSingle();
  if (!cls) return null;
  const classRow = cls as ClassInsight;

  const { data: studentRows } = await supabase
    .from('class_insight_snapshots')
    .select(STUDENT_COLUMNS)
    .eq('class_id', classId)
    .eq('snapshot_date', classRow.snapshot_date);
  const rows = (studentRows as StudentInsight[]) ?? [];

  const ids = new Set<number>();
  for (const id of [classRow.summary_template_id, classRow.behind_template_id, classRow.well_template_id,
    classRow.hard_template_id, classRow.skipper_template_id]) if (id !== null) ids.add(id);
  for (const r of rows) for (const p of r.paragraph ?? []) if (p.template_id !== null) ids.add(p.template_id);

  const templates: Record<number, Template> = {};
  if (ids.size > 0) {
    const { data: tpl } = await supabase.from('insight_templates').select('id, text_uz, text_en').in('id', [...ids]);
    for (const t of (tpl as Template[]) ?? []) templates[t.id] = t;
  }
  return { classRow, rows, templates };
}

// Names come from get_class_dashboard (SECURITY DEFINER) because profiles RLS
// only lets a user read their own row.
export async function loadStudentMeta(classId: string): Promise<Record<string, StudentMeta>> {
  const [{ data }, { data: approved }] = await Promise.all([
    supabase.rpc('get_class_dashboard', { p_class_id: classId }),
    supabase.from('class_members').select('student_id').eq('class_id', classId).eq('status', 'approved'),
  ]);
  const approvedIds = new Set((approved ?? []).map(r => r.student_id as string));
  const map: Record<string, StudentMeta> = {};
  for (const s of (data as { student_id: string; name: string | null; avatar_url: string | null }[]) ?? []) {
    if (approvedIds.has(s.student_id)) map[s.student_id] = { name: s.name ?? '', avatar_url: s.avatar_url };
  }
  return map;
}

export function templateText(t: Template | undefined, lang: Lang): string | null {
  if (!t) return null;
  return lang === 'uz' ? t.text_uz : (t.text_en ?? t.text_uz);
}

// ── Sorting and colours ─────────────────────────────────────────────────────

const TREND_RANK: Record<string, number> = { falling: 0, steady: 1, rising: 2 };

// Most urgent first: frequent skippers (most days first), then levels 1→6
// (falling before steady before rising), then students with nothing due.
export function urgencyCompare(a: StudentInsight, b: StudentInsight): number {
  const kindRank = (s: StudentInsight) => (s.kind === 'skipper' ? 0 : s.kind === 'level' ? 1 : 2);
  return kindRank(a) - kindRank(b)
    || b.days_skipped - a.days_skipped
    || (a.level ?? 9) - (b.level ?? 9)
    || TREND_RANK[a.trend ?? 'steady'] - TREND_RANK[b.trend ?? 'steady'];
}

export function needsAttention(s: StudentInsight): boolean {
  return s.kind === 'skipper' || (s.level !== null && s.level <= 3);
}

export function dotColor(s: StudentInsight): string {
  if (s.kind === 'neutral') return 'var(--text-muted)';
  if (needsAttention(s)) return 'var(--danger)';
  if (s.level === 4) return 'var(--warning)';
  return 'var(--success)';
}

export function trendArrow(trend: StudentInsight['trend']): string {
  return trend === 'rising' ? '↑' : trend === 'falling' ? '↓' : trend === 'steady' ? '→' : '';
}

// ── Dates ───────────────────────────────────────────────────────────────────

const WEEKDAYS: Record<Lang, string[]> = {
  // index = JS getDay(): 0 = Sunday
  uz: ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};

const WEEKDAYS_SHORT: Record<Lang, string[]> = {
  uz: ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};

const dowOf = (iso: string) => new Date(iso + 'T00:00:00').getDay();
export const weekdayName = (iso: string, lang: Lang) => WEEKDAYS[lang][dowOf(iso)];
export const weekdayShort = (iso: string, lang: Lang) => WEEKDAYS_SHORT[lang][dowOf(iso)];

export function fmtDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}

export function homeworkName(t: LearnTask): string {
  if (t.unit_name) return t.unit_name;
  if (t.passage_id !== null) return readingPassages.find(p => p.id === t.passage_id)?.title ?? `#${t.passage_id}`;
  if (t.collection_name) return t.day_number !== null ? `${t.collection_name} — ${t.day_number}` : t.collection_name;
  return '—';
}

// ── Week counts ─────────────────────────────────────────────────────────────

export function weekCounts(w: WeekTasks | undefined): { done: number; total: number; pct: number | null } {
  if (!w) return { done: 0, total: 0, pct: null };
  const total = w.learn.length + w.review.length;
  const done = w.learn.filter(t => t.status === 'done').length + w.review.filter(r => r.status === 'done').length;
  return { done, total, pct: total > 0 ? Math.round((100 * done) / total) : null };
}

// ── Sentence rendering ──────────────────────────────────────────────────────

export type ChipAction =
  | { type: 'week'; week: 'this' | 'last' }
  | { type: 'day'; date: string }
  | { type: 'open'; date: string }
  | { type: 'late' }
  | { type: 'hard' }
  | { type: 'action'; action: 'reminder' | 'checkin' | 'praise' | 'message' };

export type Segment =
  | { kind: 'text'; text: string }
  | { kind: 'chip'; text: string; action: ChipAction; italic?: boolean };

function joinList(items: Segment[][], lang: Lang): Segment[] {
  const out: Segment[] = [];
  items.forEach((item, i) => {
    if (i > 0) out.push({ kind: 'text', text: i === items.length - 1 ? (lang === 'uz' ? ' va ' : ' and ') : ', ' });
    out.push(...item);
  });
  return out;
}

const dayChips = (dates: string[], lang: Lang, toAction: (d: string) => ChipAction): Segment[] =>
  joinList(dates.map(d => [{ kind: 'chip', text: weekdayName(d, lang), action: toAction(d) }]), lang);

const weekText = (c: { done: number; total: number; pct: number | null }) =>
  c.total > 0 ? `${c.done}/${c.total} (${c.pct}%)` : '0/0';

// Turns one saved sentence into segments. Placeholders it can't fill are
// dropped rather than shown as raw {braces}.
export function renderSentence(text: string, s: StudentInsight, name: string, lang: Lang): Segment[] {
  const days = (s.days ?? []).filter(d => !d.before_join);
  const thisWeek = s.tasks?.this_week;
  const out: Segment[] = [];
  const re = /\{(\w+)(?::([^}]*))?\}/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ kind: 'text', text: text.slice(last, m.index) });
    last = m.index + m[0].length;
    const [, key, label] = m;

    switch (key) {
      case 'name':
        out.push({ kind: 'text', text: name });
        break;
      case 'this_week':
        out.push({ kind: 'chip', text: weekText(weekCounts(thisWeek)), action: { type: 'week', week: 'this' } });
        break;
      case 'last_week':
        out.push({ kind: 'chip', text: weekText(weekCounts(s.tasks?.last_week)), action: { type: 'week', week: 'last' } });
        break;
      case 'missed_days':
        out.push(...dayChips(days.filter(d => d.missed).map(d => d.date), lang, date => ({ type: 'day', date })));
        break;
      case 'active_days':
        out.push(...dayChips(days.filter(d => d.active).map(d => d.date), lang, date => ({ type: 'day', date })));
        break;
      case 'open_days': {
        const dates = [...new Set((thisWeek?.learn ?? []).filter(t => t.status === 'open').map(t => t.due_date))];
        out.push(...dayChips(dates, lang, date => ({ type: 'open', date })));
        break;
      }
      case 'late_tasks': {
        const n = (thisWeek?.learn ?? []).filter(t => t.status === 'late').length;
        const label = lang === 'uz' ? (n === 1 ? 'Bitta vazifa' : `${n} ta vazifa`) : (n === 1 ? 'One homework' : `${n} homeworks`);
        out.push({ kind: 'chip', text: label, action: { type: 'late' } });
        break;
      }
      case 'hard_words':
        out.push({ kind: 'chip', text: (s.hard_words?.shared ?? []).join(lang === 'uz' ? ' va ' : ' and '), action: { type: 'hard' }, italic: true });
        break;
      case 'hard_count': {
        const n = s.hard_words?.own.length ?? 0;
        out.push({ kind: 'chip', text: lang === 'uz' ? `${n} ta so'z` : `${n} words`, action: { type: 'hard' } });
        break;
      }
      case 'reminder':
      case 'checkin':
      case 'praise':
      case 'message':
        out.push({ kind: 'chip', text: label ?? key, action: { type: 'action', action: key } });
        break;
    }
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) });

  // A sentence that starts with a weekday chip ("juma kunidan…") still needs
  // a capital letter.
  const first = out[0];
  if (first && first.text.length > 0) {
    out[0] = { ...first, text: first.text[0].toUpperCase() + first.text.slice(1) } as Segment;
  }
  return out;
}

export function renderParagraph(s: StudentInsight, templates: Record<number, Template>, name: string, lang: Lang): Segment[][] {
  return (s.paragraph ?? [])
    .map(p => templateText(p.template_id !== null ? templates[p.template_id] : undefined, lang))
    .filter((t): t is string => t !== null)
    .map(t => renderSentence(t, s, name, lang));
}

export const segmentsToText = (segs: Segment[]) => segs.map(s => s.text).join('');

// Plain {placeholder} filling for the class-level sentences.
export function fillPlain(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (m, key) => (vars[key] !== undefined ? String(vars[key]) : m));
}
