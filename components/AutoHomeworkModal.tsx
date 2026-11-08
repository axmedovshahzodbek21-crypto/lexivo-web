'use client';
// Auto homework (teacher): "X units a day" for one collection or library
// folder. The nightly job (migration 20261108000001) does the assigning; this
// only edits the class_auto_homework row. Mirrors lexivo
// lib/screens/auto_homework_sheet.dart.
import { appConfirm } from '@/components/ConfirmDialog';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getUILanguage } from '@/lib/storage';
import { useTranslation } from '@/lib/useTranslation';

const S = {
  title:       { en: 'Auto homework', uz: 'Avtomatik uy vazifasi', ru: 'Автодомашка' },
  sub:         { en: 'Units are assigned to the whole class every chosen day.', uz: 'Tanlangan kunlarda butun sinfga unitlar avtomatik beriladi.', ru: 'Юниты назначаются всему классу в выбранные дни.' },
  perDay:      { en: 'Units per day', uz: 'Kuniga nechta unit', ru: 'Юнитов в день' },
  days:        { en: 'Days', uz: 'Kunlar', ru: 'Дни' },
  deadline:    { en: 'Deadline', uz: 'Muddat', ru: 'Срок' },
  none:        { en: 'None', uz: "Yo'q", ru: 'Нет' },
  nDays:       { en: '{n} d', uz: '{n} kun', ru: '{n} дн' },
  modes:       { en: 'Modes', uz: 'Rejimlar', ru: 'Режимы' },
  order:       { en: 'Order', uz: 'Tartib', ru: 'Порядок' },
  inOrder:     { en: 'In order', uz: 'Ketma-ket', ru: 'По порядку' },
  random:      { en: 'Random', uz: 'Tasodifiy', ru: 'Случайно' },
  randomN:     { en: '{n} random unit(s)', uz: '{n} ta tasodifiy unit', ru: 'Случайных юнитов: {n}' },
  start:       { en: 'Start', uz: 'Boshlash', ru: 'Начало' },
  today:       { en: 'Today', uz: 'Bugundan', ru: 'Сегодня' },
  tomorrow:    { en: 'Tomorrow', uz: 'Ertadan', ru: 'Завтра' },
  plan:        { en: 'Plan', uz: 'Reja', ru: 'План' },
  lastUnit:    { en: 'Last unit: {d}', uz: 'Oxirgi unit: {d}', ru: 'Последний юнит: {d}' },
  nothingLeft: { en: 'Every unit is already assigned.', uz: 'Hamma unitlar allaqachon berilgan.', ru: 'Все юниты уже назначены.' },
  holdNote:    { en: 'If fewer than half the class finished the previous units, that day is skipped.', uz: "Agar sinfning yarmidan kami oldingi unitlarni tugatmagan bo'lsa, o'sha kun yangi unit berilmaydi.", ru: 'Если меньше половины класса закончили прошлые юниты, день пропускается.' },
  save:        { en: 'Save', uz: 'Saqlash', ru: 'Сохранить' },
  cancel:      { en: 'Cancel', uz: 'Bekor qilish', ru: 'Отмена' },
  pause:       { en: 'Pause', uz: 'Pauza', ru: 'Пауза' },
  resume:      { en: 'Resume', uz: 'Davom ettirish', ru: 'Продолжить' },
  turnOff:     { en: 'Turn off', uz: "O'chirish", ru: 'Выключить' },
  turnOffQ:    { en: 'Turn off auto homework? Already assigned units stay.', uz: "Avtomatik uy vazifasi o'chirilsinmi? Berilgan unitlar qoladi.", ru: 'Выключить? Назначенные юниты останутся.' },
  failed:      { en: 'Could not save', uz: "Saqlab bo'lmadi", ru: 'Не удалось сохранить' },
  stPaused:    { en: 'Paused', uz: 'Pauzada', ru: 'На паузе' },
  stStarts:    { en: 'Starts {d}', uz: '{d} dan boshlanadi', ru: 'Начнётся {d}' },
  stReleased:  { en: '{n} unit(s) assigned', uz: '{n} ta unit berildi', ru: 'Назначено юнитов: {n}' },
  stHeld:      { en: 'held — under half the class finished', uz: "to'xtatildi — sinfning yarmidan kami tugatgan", ru: 'пауза — закончили меньше половины' },
  stDone:      { en: 'All units assigned', uz: 'Hamma unitlar berildi', ru: 'Все юниты назначены' },
  stToday:     { en: 'Today', uz: 'Bugun', ru: 'Сегодня' },
  perDayShort: { en: '{n}/day', uz: 'kuniga {n} ta', ru: '{n} в день' },
  auto:        { en: 'Auto', uz: 'Avto', ru: 'Авто' },
} as const;

export function autoT(key: keyof typeof S): string {
  return S[key][getUILanguage()] ?? S[key].en;
}

const WEEKDAYS = { en: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'], uz: ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'], ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] };

/** Tashkent "today" (UTC+5, no DST) as a UTC-midnight Date — the job's day boundary. */
function tashkentToday(): Date {
  const t = new Date(Date.now() + 5 * 3600_000);
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
}
const iso = (d: Date) => d.toISOString().slice(0, 10);
const short = (d: Date) => `${d.getUTCDate()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400_000);
const isoDow = (d: Date) => ((d.getUTCDay() + 6) % 7) + 1;

export interface AutoSchedule {
  id: string;
  collection_name: string | null;
  folder_id: string | null;
  units_per_day: number;
  weekdays: number[];
  modes: string[];
  due_days: number | null;
  random_order: boolean;
  paused: boolean;
  start_date: string;
  last_run_on: string | null;
  last_status: 'released' | 'held' | 'done' | null;
  last_count: number;
}

export const AUTO_SELECT = 'id, collection_name, folder_id, units_per_day, weekdays, modes, due_days, random_order, paused, start_date, last_run_on, last_status, last_count';

/** One line for the teacher's card, e.g. "⚡ kuniga 2 ta · Bugun: 2 ta unit berildi". */
export function autoStatusLine(a: AutoSchedule): string {
  const head = `⚡ ${autoT('perDayShort').replace('{n}', String(a.units_per_day))}`;
  if (a.paused) return `${head} · ${autoT('stPaused')}`;
  const today = iso(tashkentToday());
  if (!a.last_run_on) {
    return a.start_date > today ? `${head} · ${autoT('stStarts').replace('{d}', short(new Date(a.start_date)))}` : head;
  }
  if (a.last_status === 'done') return `${head} · ${autoT('stDone')}`;
  const when = a.last_run_on === today ? autoT('stToday') : short(new Date(a.last_run_on));
  const what = a.last_status === 'released' ? autoT('stReleased').replace('{n}', String(a.last_count))
    : a.last_status === 'held' ? autoT('stHeld') : '';
  return `${head} · ${when}: ${what}`;
}

export default function AutoHomeworkModal({
  classId, teacherId, sourceTitle, collectionName, dayNumbers, folderId, remaining, existing, onClose, onSaved,
}: {
  classId: string;
  teacherId: string;
  sourceTitle: string;
  collectionName?: string;
  dayNumbers?: number[];
  folderId?: string;
  /** Labels of units not yet assigned to the whole class, in release order. */
  remaining: string[];
  existing?: AutoSchedule;
  onClose: () => void;
  onSaved: () => void;
}) {
  const tt = useTranslation();
  const lang = getUILanguage();
  const wd = WEEKDAYS[lang] ?? WEEKDAYS.en;
  const [perDay, setPerDay] = useState(existing?.units_per_day ?? 1);
  const [weekdays, setWeekdays] = useState<Set<number>>(new Set(existing?.weekdays ?? [1, 2, 3, 4, 5, 6]));
  const [match, setMatch] = useState(existing?.modes.includes('match') ?? false);
  const [dueDays, setDueDays] = useState<number | null>(existing ? existing.due_days : 1);
  const [randomOrder, setRandomOrder] = useState(existing?.random_order ?? false);
  const [startToday, setStartToday] = useState(true);
  const [busy, setBusy] = useState(false);

  // Plan preview: walk the calendar from the first release day, ignoring
  // holds (they depend on how the class does).
  const plan = (() => {
    if (remaining.length === 0 || weekdays.size === 0) return [];
    const lines: string[] = [];
    const t = tashkentToday();
    let day = t;
    if (!existing && !startToday) day = addDays(day, 1);
    if (existing) {
      const s = new Date(existing.start_date);
      day = s > t ? s : t;
      if (existing.last_run_on === iso(t)) day = addDays(day, 1);
    }
    let idx = 0;
    let last: Date | null = null;
    for (let guard = 0; idx < remaining.length && guard < 2000; guard++) {
      const dow = isoDow(day);
      if (weekdays.has(dow)) {
        const batch = remaining.slice(idx, idx + perDay);
        const what = randomOrder ? autoT('randomN').replace('{n}', String(batch.length)) : batch.join(', ');
        if (lines.length < 6) lines.push(`${wd[dow - 1]} ${short(day)}: ${what}`);
        idx += batch.length;
        last = day;
      }
      day = addDays(day, 1);
    }
    if (last) lines.push(autoT('lastUnit').replace('{d}', short(last)));
    return lines;
  })();

  const settings = () => ({
    units_per_day: perDay,
    weekdays: [...weekdays].sort(),
    modes: ['learn', 'flashcard', 'quiz', ...(match ? ['match'] : [])],
    due_days: dueDays,
    random_order: randomOrder,
    ...(collectionName ? { day_numbers: dayNumbers } : {}),
  });

  async function save(patch: Record<string, unknown>) {
    setBusy(true);
    let error;
    if (!existing) {
      const res = await supabase.from('class_auto_homework').insert({
        class_id: classId,
        teacher_id: teacherId,
        ...(collectionName ? { collection_name: collectionName } : { folder_id: folderId }),
        ...(startToday ? {} : { start_date: iso(addDays(tashkentToday(), 1)) }),
        ...patch,
      }).select('id').single();
      error = res.error;
      if (!error && startToday) error = (await supabase.rpc('auto_homework_run_today', { p_id: res.data!.id })).error;
    } else {
      error = (await supabase.from('class_auto_homework').update(patch).eq('id', existing.id)).error;
    }
    if (error) { console.error('[AutoHomeworkModal]', error); alert(`${autoT('failed')}: ${error.message}`); setBusy(false); return; }
    onSaved();
  }

  async function turnOff() {
    if (!existing || !(await appConfirm(autoT('turnOffQ')))) return;
    setBusy(true);
    const { error } = await supabase.from('class_auto_homework').delete().eq('id', existing.id);
    if (error) { alert(`${autoT('failed')}: ${error.message}`); setBusy(false); return; }
    onSaved();
  }

  const chip = (label: string, on: boolean, onClick: () => void, key?: string | number) => (
    <button key={key ?? label} onClick={onClick}
      className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
      style={{ background: on ? 'var(--primary)' : 'var(--surface-2)', color: on ? 'white' : 'var(--text-muted)' }}>
      {label}
    </button>
  );
  const label = (text: string) => <p className="text-xs font-semibold text-[var(--text-muted)] mb-2 mt-4 uppercase tracking-wide">{text}</p>;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md bg-[var(--surface)] rounded-t-3xl p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="w-9 h-1 rounded-full bg-[var(--border)] mx-auto mb-4" />
        <p className="font-bold text-lg text-[var(--text)]">⚡ {autoT('title')}</p>
        <p className="text-sm font-semibold text-[var(--text)] mt-1">{sourceTitle}</p>
        <p className="text-xs text-[var(--text-muted)]">{autoT('sub')}</p>
        {existing && <p className="text-xs font-semibold text-[var(--primary)] mt-2">{autoStatusLine(existing)}</p>}

        {label(autoT('perDay'))}
        <div className="flex items-center gap-4">
          <button disabled={perDay <= 1} onClick={() => setPerDay(p => p - 1)} className="w-9 h-9 rounded-full bg-[var(--surface-2)] text-[var(--text)] font-bold disabled:opacity-40">−</button>
          <span className="text-xl font-black text-[var(--text)] w-6 text-center">{perDay}</span>
          <button disabled={perDay >= 10} onClick={() => setPerDay(p => p + 1)} className="w-9 h-9 rounded-full bg-[var(--surface-2)] text-[var(--text)] font-bold disabled:opacity-40">+</button>
        </div>

        {label(autoT('order'))}
        <div className="flex gap-1.5">
          {chip(autoT('inOrder'), !randomOrder, () => setRandomOrder(false))}
          {chip(`🎲 ${autoT('random')}`, randomOrder, () => setRandomOrder(true))}
        </div>

        {label(autoT('days'))}
        <div className="flex flex-wrap gap-1.5">
          {wd.map((name, i) => chip(name, weekdays.has(i + 1), () => setWeekdays(prev => {
            const next = new Set(prev);
            if (next.has(i + 1)) { if (next.size > 1) next.delete(i + 1); } else { next.add(i + 1); }
            return next;
          }), i))}
        </div>

        {label(autoT('deadline'))}
        <div className="flex flex-wrap gap-1.5">
          {[null, 1, 2, 3, 7].map(n => chip(n == null ? autoT('none') : autoT('nDays').replace('{n}', String(n)), dueDays === n, () => setDueDays(n), String(n)))}
        </div>

        {label(autoT('modes'))}
        <div className="flex flex-wrap gap-1.5">
          {chip(`📖 ${tt.nav.learn} *`, true, () => {})}
          {chip(`🃏 ${tt.classesPage.hwModeCards} *`, true, () => {})}
          {chip(`🧠 ${tt.nav.quiz} *`, true, () => {})}
          {chip(`🎯 ${tt.classesPage.hwModeMatch}`, match, () => setMatch(m => !m))}
        </div>

        {!existing && (<>
          {label(autoT('start'))}
          <div className="flex gap-1.5">
            {chip(autoT('today'), startToday, () => setStartToday(true))}
            {chip(autoT('tomorrow'), !startToday, () => setStartToday(false))}
          </div>
        </>)}

        {label(autoT('plan'))}
        <div className="rounded-xl p-3 space-y-1" style={{ background: 'var(--surface-2)' }}>
          {plan.length === 0
            ? <p className="text-xs text-[var(--text-muted)]">{autoT('nothingLeft')}</p>
            : plan.map((l, i) => <p key={i} className="text-xs text-[var(--text)]">{l}</p>)}
          <p className="text-[11px] text-[var(--text-muted)] pt-1">{autoT('holdNote')}</p>
        </div>

        <button disabled={busy} onClick={() => save(settings())} className="w-full btn-primary py-3 mt-5">{autoT('save')}</button>
        {existing && (
          <div className="flex gap-2 mt-2">
            <button disabled={busy} onClick={() => save({ paused: !existing.paused })} className="flex-1 btn-ghost py-2.5">{existing.paused ? autoT('resume') : autoT('pause')}</button>
            <button disabled={busy} onClick={turnOff} className="flex-1 btn-ghost py-2.5" style={{ color: 'var(--danger)' }}>{autoT('turnOff')}</button>
          </div>
        )}
        <button onClick={onClose} className="w-full btn-ghost py-2.5 mt-2">{autoT('cancel')}</button>
      </div>
    </div>
  );
}
