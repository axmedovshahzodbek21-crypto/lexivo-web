// Audits lib/battle-ready-content/topics/<slug>.json for three problems that
// plain JSON validation (topics:fix) can't catch:
//   1. Still-empty placeholders (informational, not a problem).
//   2. Broken JSON (delegates the same check topics:fix uses).
//   3. Content that doesn't actually mention its own topic anywhere — the
//      signature of pasting one topic's AI output into a different topic's
//      file.
//   4. Two different topic files containing identical (or near-identical)
//      content — the signature of pasting the same output twice.
//
// Usage: node scripts/audit-battle-ready-topics.js

const fs = require('fs');
const path = require('path');

const TOPICS_DIR = path.join(__dirname, '..', 'lib', 'battle-ready-content', 'topics');
const DEBATE_MOCK_PATH = path.join(__dirname, '..', 'lib', 'debateMock.ts');

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'over', 'under',
  'life', 'events', 'issues', 'people',
]);

function slugify(title, dedupeSuffix) {
  const base = title
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return dedupeSuffix ? `${base}-${dedupeSuffix}` : base;
}

function loadSlugToTitle() {
  const src = fs.readFileSync(DEBATE_MOCK_PATH, 'utf8');
  const match = /TOPIC_TITLES[\s\S]*?=\s*\[([\s\S]*?)\n\];/.exec(src);
  if (!match) throw new Error('Could not find TOPIC_TITLES in debateMock.ts');
  const body = match[1];
  const pairRe = /\[\s*['"]((?:[^'"\\]|\\.)*)['"]\s*,\s*['"][^'"]*['"]\s*\]/g;
  const titles = [];
  let m;
  while ((m = pairRe.exec(body))) {
    titles.push(m[1].replace(/\\'/g, "'"));
  }

  const seen = new Set();
  const map = {};
  for (const title of titles) {
    let slug = slugify(title);
    if (seen.has(slug)) slug = slugify(title, '2');
    seen.add(slug);
    map[slug] = title;
  }
  return map;
}

function significantTokens(title) {
  const words = title
    .toLowerCase()
    .replace(/[’']/g, '')
    .split(/[^a-z0-9]+/)
    .filter(w => w.length >= 3 && !STOPWORDS.has(w));
  return words.length > 0 ? words : title.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function hashContent(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(h, 31) + str.charCodeAt(i)) | 0;
  return h;
}

function main() {
  const slugToTitle = loadSlugToTitle();
  const files = fs.readdirSync(TOPICS_DIR).filter(f => f.endsWith('.json'));

  let empty = 0, filled = 0, broken = 0;
  const brokenList = [];
  const mismatchList = [];
  const seenByHash = new Map(); // hash -> [slug, ...]
  const seenByMotion = new Map(); // motion text -> [slug, ...]

  for (const file of files) {
    const slug = file.replace(/\.json$/, '');
    const title = slugToTitle[slug];
    const fullPath = path.join(TOPICS_DIR, file);
    const raw = fs.readFileSync(fullPath, 'utf8');

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      broken++;
      brokenList.push(`${file}: ${e.message}`);
      continue;
    }

    if (parsed === null) {
      empty++;
      continue;
    }
    filled++;

    if (!title) {
      mismatchList.push(`${file}: no matching topic title found for this slug (stale/renamed file?)`);
      continue;
    }

    const contentText = JSON.stringify(parsed).toLowerCase();
    const tokens = significantTokens(title);
    const mentioned = tokens.some(t => contentText.includes(t));
    if (!mentioned) {
      mismatchList.push(`${file} ("${title}"): content never mentions [${tokens.join(', ')}] anywhere — likely wrong content pasted here`);
    }

    // Duplicate-content detection.
    const hash = hashContent(contentText);
    if (!seenByHash.has(hash)) seenByHash.set(hash, []);
    seenByHash.get(hash).push(slug);

    if (parsed.motion) {
      const m = parsed.motion.trim().toLowerCase();
      if (!seenByMotion.has(m)) seenByMotion.set(m, []);
      seenByMotion.get(m).push(slug);
    }
  }

  console.log(`Checked ${files.length} topic files.`);
  console.log(`  Filled:  ${filled}`);
  console.log(`  Empty:   ${empty}`);
  console.log(`  Broken:  ${broken}`);

  if (brokenList.length) {
    console.log(`\nBroken JSON (run "npm run topics:fix" first, then re-audit):`);
    brokenList.forEach(l => console.log(`  - ${l}`));
  }

  if (mismatchList.length) {
    console.log(`\nPossible wrong-topic pastes (${mismatchList.length}):`);
    mismatchList.forEach(l => console.log(`  - ${l}`));
  } else {
    console.log(`\nNo topic/content mismatches detected.`);
  }

  const dupHashGroups = [...seenByHash.values()].filter(g => g.length > 1);
  const dupMotionGroups = [...seenByMotion.values()].filter(g => g.length > 1);
  if (dupHashGroups.length) {
    console.log(`\nIdentical content pasted into multiple files:`);
    dupHashGroups.forEach(g => console.log(`  - ${g.join(', ')}`));
  }
  if (dupMotionGroups.length) {
    console.log(`\nSame motion text used across multiple files (check these too):`);
    dupMotionGroups.forEach(g => console.log(`  - ${g.join(', ')}`));
  }
  if (!dupHashGroups.length && !dupMotionGroups.length) {
    console.log(`No duplicate content across files.`);
  }
}

main();
