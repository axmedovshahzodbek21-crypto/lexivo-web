// Checks lib/student-summary-sentences.ts: every sentence uses only the
// placeholders and [[label|key]] links its case actually provides (see the
// picks in lib/student-summary.ts), Uzbek sentences carry no English verb
// placeholders, and markup is well-formed. Run after editing sentences:
//   node scripts/check-student-summary.js
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const src = fs.readFileSync(path.join(__dirname, '../lib/student-summary-sentences.ts'), 'utf8');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const m = { exports: {} };
new Function('exports', 'module', js)(m.exports, m);
const S = m.exports.SUMMARY_SENTENCES;

const WHO = ['name', 'nameObj'];
const AGREE = ['s', 'es', 'has', 'hasnt', 'is', 'was', 'doesnt'];
const HW = ['homework', 'timing'];
// case -> [vars, links]; keep in sync with the picks in lib/student-summary.ts
const SPEC = {
  not_enough_data: [[], []],
  ctx_joined_today_active: [[], ['days']], ctx_joined_today: [[], []],
  ctx_new_all_active: [['since'], ['days']], ctx_new_some_active: [['since', 'active', 'days'], ['days']],
  ctx_new_inactive: [['since'], []],
  ctx_week_high: [['active'], ['days']], ctx_week_mid: [['active'], ['days']],
  ctx_week_low: [['active', 'dayWord'], ['days']], ctx_week_none: [['last'], ['days']], ctx_never: [[], []],
  act_review_cleared: [['when', 'n'], ['review']], act_review_hw: [['when', 'n', 'hw'], ['review', 'homework']],
  act_review: [['when', 'n'], ['review']], act_hw: [['when', 'hw'], ['homework']],
  act_hw_partial: [['when', 'hw', 'left'], HW], act_other: [['when'], ['days']],
  rev_waiting: [['n'], []], rev_overdue: [['n', 'm'], []], rev_stopped: [['days', 'n'], ['review']], rev_never: [['n'], []],
  hw_few_early: [['hw', 'early'], HW], hw_few_on_time: [['hw'], HW], hw_few_late: [['hw', 'late'], HW],
  hw_few_open: [['hw', 'left'], HW], hw_few_open_many: [['hw'], HW], hw_few_mixed: [['hw'], HW],
  hw_early: [[], HW], hw_last_day: [[], HW], hw_on_time: [['total'], HW], hw_same_day: [[], HW],
  hw_late_finishes: [['freq'], HW], hw_some_missing: [['total', 'done', 'missed'], HW],
  hw_many_missing: [['total', 'done', 'missed'], HW], hw_none_done: [['total'], HW],
  hw_improving: [[], ['timing']], hw_slipping: [[], ['timing']],
  trd_up_strong: [['pct'], ['weeks']], trd_up: [['pct'], ['weeks']], trd_record: [[], ['weeks']],
  trd_steady: [[], ['weeks']], trd_down: [['pct'], ['weeks']], trd_down_strong: [['pct'], ['weeks']], trd_back: [[], ['weeks']],
  str_record: [['streak'], ['days']], str_long: [['streak'], ['days']], str_mid: [['streak'], ['days']],
  str_broken: [['longest', 'days'], ['days']],
  tim_same_hour: [['hour'], ['sessions']], tim_morning: [[], ['sessions']], tim_afternoon: [[], ['sessions']],
  tim_evening: [[], ['sessions']], tim_night: [[], ['sessions']], tim_varied: [[], ['sessions']],
  wk_weekend: [[], ['days']], ses_multi: [['x'], ['sessions']],
  rq_strong: [['pct', 'total'], ['accuracy']], rq_good: [['pct', 'total'], ['accuracy']],
  rq_mixed: [['pct', 'total'], ['accuracy']], rq_hard: [['pct', 'total'], ['accuracy']],
  rq_improving: [['from', 'to'], ['accuracy']], rq_dropping: [['from', 'to'], ['accuracy']],
  rq_hard_words: [['words'], ['words']], rq_recovered: [['words'], ['words']],
  mst_hw_streak: [['n'], ['timing']], mst_mastered_first: [['n'], []],
  mst_mastered_small: [['n', 'learned'], []], mst_mastered_mid: [['n', 'learned'], []],
  mst_mastered_big: [['n', 'learned'], []], mst_reviews_total: [['n'], []],
  rem_quick: [[], ['reminders']], rem_slow: [[], ['reminders']], rem_mixed: [[], ['reminders']],
  rem_read_no_action: [[], ['reminders']], rem_unread: [[], ['reminders']], rem_not_needed: [[], ['days']],
  rem_single_responded: [['hours'], ['reminders']], rem_single_read: [[], ['reminders']], rem_single_unread: [[], ['reminders']],
};

const errors = [];
let count = { uz: 0, en: 0 };
for (const code of Object.keys(SPEC)) if (!S[code]) errors.push(`${code}: missing from the bank`);
for (const [code, langs] of Object.entries(S)) {
  const spec = SPEC[code];
  if (!spec) { errors.push(`${code}: not in SPEC (is the engine picking it?)`); continue; }
  const [vars, links] = spec;
  for (const lang of ['uz', 'en']) {
    const list = langs[lang] ?? [];
    if (list.length === 0) errors.push(`${code}.${lang}: no sentences`);
    if (new Set(list).size !== list.length) errors.push(`${code}.${lang}: duplicate sentence`);
    for (const t of list) {
      count[lang]++;
      const where = `${code}.${lang}: "${t}"`;
      const allowed = new Set([...WHO, ...vars, ...(lang === 'en' ? AGREE : [])]);
      for (const [, k] of t.matchAll(/\{(\w+)\}/g)) if (!allowed.has(k)) errors.push(`${where} — unknown {${k}}`);
      for (const [, , key] of t.matchAll(/\[\[(.+?)\|(\w+)\]\]/g)) if (!links.includes(key)) errors.push(`${where} — link key "${key}" not available`);
      const stripped = t.replace(/\[\[(.+?)\|(\w+)\]\]/g, '');
      if (/\[\[|\]\]|\|/.test(stripped)) errors.push(`${where} — broken [[label|key]] markup`);
      if ((t.match(/\[\[/g) ?? []).length > 2) errors.push(`${where} — more than 2 links`);
    }
  }
}
console.log(`${Object.keys(S).length} cases, ${count.uz} uz + ${count.en} en sentences`);
if (errors.length) { console.log(errors.join('\n')); process.exit(1); }
console.log('OK');
