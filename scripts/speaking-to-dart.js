// Generates lexivo/lib/data/speaking_data.dart from lib/speaking-data.ts.
// Run after editing the question bank: node scripts/speaking-to-dart.js
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const src = fs.readFileSync(path.join(__dirname, '../lib/speaking-data.ts'), 'utf8');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const m = { exports: {} };
new Function('exports', 'module', js)(m.exports, m);
const { part1Topics, part2Cards, part3Topics } = m.exports;

const q = (s) => '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$') + '"';
const groups = (name, list) => {
  let o = `const ${name} = <SpeakingTopicGroup>[\n`;
  for (const g of list) {
    o += `  SpeakingTopicGroup(${q(g.topic)}, [\n`;
    for (const x of g.questions) o += `    ${q(x)},\n`;
    o += '  ]),\n';
  }
  return o + '];\n\n';
};

let out = '// GENERATED from lexivo-web/lib/speaking-data.ts by scripts/speaking-to-dart.js — do not edit by hand.\n';
out += '// Full question bank transcribed from "1000 IELTS Speaking Questions (Updated 2025)".\n\n';
out += 'class SpeakingTopicGroup {\n  final String topic;\n  final List<String> questions;\n  const SpeakingTopicGroup(this.topic, this.questions);\n}\n\n';
out += 'class SpeakingCueCard {\n  final String topic, prompt;\n  final List<String> bullets;\n  final String? closing;\n  const SpeakingCueCard(this.topic, this.prompt, this.bullets, [this.closing]);\n}\n\n';
out += groups('speakingPart1Topics', part1Topics);
out += 'const speakingPart2Cards = <SpeakingCueCard>[\n';
for (const c of part2Cards) {
  out += `  SpeakingCueCard(${q(c.topic)}, ${q(c.prompt)}, [${c.bullets.map(q).join(', ')}]${c.closing ? `, ${q(c.closing)}` : ''}),\n`;
}
out += '];\n\n';
out += groups('speakingPart3Topics', part3Topics);
out += '// Flattened pools for random selection: (topic, question).\n';
out += 'final speakingPart1Pool = [for (final g in speakingPart1Topics) for (final q in g.questions) (topic: g.topic, question: q)];\n';
out += 'final speakingPart3Pool = [for (final g in speakingPart3Topics) for (final q in g.questions) (topic: g.topic, question: q)];\n';

fs.writeFileSync(path.join(__dirname, '../../lexivo/lib/data/speaking_data.dart'), out);
console.log('wrote', part1Topics.length, 'part1 topics,', part2Cards.length, 'cue cards,', part3Topics.length, 'part3 topics');
