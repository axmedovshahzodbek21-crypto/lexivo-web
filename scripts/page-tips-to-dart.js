// Regenerates the copy part of lexivo/lib/data/page_tips.dart from lib/page-tips.ts.
// Run after editing tip copy: node scripts/page-tips-to-dart.js
const fs = require('fs');
const ts = require('typescript');
const src = fs.readFileSync(require('path').join(__dirname, '../lib/page-tips.ts'), 'utf8');
const a = src.indexOf('export const PAGE_TIPS_UI');
const b = src.indexOf('export function getSeenTips');
const js = ts.transpileModule(src.slice(a, b), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const m = { exports: {} };
new Function('exports', 'module', js)(m.exports, m);
const { PAGE_TIPS_UI, PAGE_TIPS } = m.exports;

const q = (s) => '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$') + '"';
let out = '';
out += 'const pageTipsUi = <String, Map<String, String>>{\n';
for (const [lang, ui] of Object.entries(PAGE_TIPS_UI)) {
  out += `  '${lang}': {\n`;
  for (const [k, v] of Object.entries(ui)) out += `    '${k}': ${q(v)},\n`;
  out += '  },\n';
}
out += '};\n\n';
out += 'const pageTips = <String, Map<String, PageTipCopy>>{\n';
for (const [id, langs] of Object.entries(PAGE_TIPS)) {
  out += `  '${id}': {\n`;
  for (const [lang, tip] of Object.entries(langs)) {
    out += `    '${lang}': PageTipCopy(${q(tip.title)}, [\n`;
    for (const [icon, title, desc] of tip.steps) out += `      (${q(icon)}, ${q(title)}, ${q(desc)}),\n`;
    out += '    ]),\n';
  }
  out += '  },\n';
}
out += '};\n';

const dartPath = require('path').join(__dirname, '../../lexivo/lib/data/page_tips.dart');
const marker = '// ── Copy (generated from lexivo-web/lib/page-tips.ts) ──\n';
const head = fs.readFileSync(dartPath, 'utf8').split(marker)[0];
fs.writeFileSync(dartPath, head + marker + out);
console.log('wrote', Object.keys(PAGE_TIPS).length, 'tips');
