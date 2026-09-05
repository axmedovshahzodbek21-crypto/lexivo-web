// Topic list for Debate Arena / Battle-Ready. Each topic is its own self-contained
// "world" — no theme grouping. Progress fields here are mock/hash-based and only
// power the older /debate pipeline prototype; /battle-ready doesn't use them.

export type DebateSide = 'for' | 'against';

export type DebateStep = {
  key: 'vocab' | 'arguments' | 'build' | 'rebuttal' | 'deliver';
  label: string;
  icon: string;
};

export const DEBATE_STEPS: DebateStep[] = [
  { key: 'vocab', label: 'Vocabulary', icon: '📖' },
  { key: 'arguments', label: 'Pick Your Case', icon: '💬' },
  { key: 'build', label: 'Build Your Case', icon: '🧩' },
  { key: 'rebuttal', label: 'Rebuttal', icon: '🛡️' },
  { key: 'deliver', label: 'Deliver', icon: '🎤' },
];

export type DebateTopic = {
  slug: string;
  title: string;
  emoji: string;
  progress: { for: number; against: number }; // 0-100, mock only
  stepsDone: { for: number; against: number }; // 0-5, mock only
};

function hashProgress(seed: string, salt: number) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i) + salt) % 101;
  return Math.abs(h) % 101;
}

function slugify(title: string, dedupeSuffix?: string) {
  const base = title
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return dedupeSuffix ? `${base}-${dedupeSuffix}` : base;
}

const TOPIC_TITLES: [string, string][] = [
  ['Childhood', '🧒'], ['Child care', '🍼'], ['Children’s education', '🎒'], ['Family', '👨‍👩‍👧'],
  ['Family ties', '🔗'], ['Parenting', '🧑‍🍼'], ['Friendship', '🤝'], ['Marriage', '💍'],
  ['Divorce', '💔'], ['Personality', '🎭'], ['Fear', '😨'], ['Happiness', '😊'],
  ['Success', '🏆'], ['Memory', '🧠'], ['Life expectancy', '⏳'], ['Hobbies', '🎨'],
  ['Music', '🎵'], ['Sport', '⚽'], ['Sportsmanship', '🤝'], ['Sporting events', '🏟️'],
  ['Fashion, clothing', '👗'], ['Diet', '🥗'], ['Obesity', '⚖️'], ['Aging', '👵'],
  ['Stress', '😣'], ['Smoking', '🚬'], ['Addiction', '💊'], ['TV', '📺'],
  ['Education', '🎓'], ['School discipline', '📏'], ['Distance learning', '💻'], ['Home schooling', '🏠'],
  ['Field trips', '🚌'], ['Illiteracy', '📕'], ['Child labor', '🧱'], ['Juvenile delinquency', '🚨'],
  ['Disability', '♿'], ['Doping', '💉'], ['Crime', '🚓'], ['Violence', '👊'],
  ['City life', '🏙️'], ['Country life', '🌾'], ['Housing', '🏘️'], ['High-rise buildings', '🏢'],
  ['Homelessness', '🏚️'], ['Urban sprawl', '🌆'], ['Traffic', '🚦'], ['Public transport', '🚌'],
  ['Culture', '🎭'], ['Cultural heritage', '🏛️'], ['Culture shock', '🌍'], ['Art', '🎨'],
  ['History', '📜'], ['Film', '🎬'], ['Tourism', '✈️'], ['Festivals', '🎉'],
  ['Astrology', '🔮'], ['Fame', '🌟'], ['Generation gap', '👴'], ['Pets', '🐶'],
  ['Language', '🗣️'], ['Mass media', '📰'], ['Advertising', '📢'], ['Social media', '📱'],
  ['The internet', '🌐'], ['Jobs', '💼'], ['Unemployment', '📉'], ['Industrial relations', '🏭'],
  ['Brain drain', '✈️'], ['Bribery', '💰'], ['Charity', '❤️'], ['Computerization', '🖥️'],
  ['Computer games', '🎮'], ['Automation', '🤖'], ['Satellites', '🛰️'], ['Space exploration', '🚀'],
  ['Agriculture', '🌾'], ['GM food', '🧬'], ['Energy', '⚡'], ['Climate', '🌡️'],
  ['Acid rain', '🌧️'], ['Air pollution', '🏭'], ['Noise pollution', '🔊'], ['Water pollution', '💧'],
  ['Recycling', '♻️'], ['Environment', '🌱'], ['Natural disasters', '🌪️'], ['Global warming', '🌍'],
  ['Aids', '🎗️'], ['Accidents', '🚑'], ['Mental health', '🧠'], ['Vaccination', '💉'],
  ['Hygiene', '🧼'], ['Migration', '🧳'], ['Famine', '🍽️'], ['Poverty', '💸'],
  ['Overpopulation', '👥'], ['Globalization', '🌐'], ['Animal testing', '🐭'], ['Zoos', '🦁'],
  ['Law', '⚖️'],
];

const seenSlugs = new Set<string>();

export const DEBATE_TOPICS: DebateTopic[] = TOPIC_TITLES.map(([title, emoji]) => {
  let slug = slugify(title);
  if (seenSlugs.has(slug)) slug = slugify(title, '2');
  seenSlugs.add(slug);

  const forP = hashProgress(slug, 1);
  const againstP = hashProgress(slug, 2);
  return {
    slug,
    title,
    emoji,
    progress: { for: forP, against: againstP },
    stepsDone: { for: Math.round((forP / 100) * 5), against: Math.round((againstP / 100) * 5) },
  };
});

export function getDebateTopic(slug: string) {
  return DEBATE_TOPICS.find(t => t.slug === slug);
}

export function isBattleReady(t: DebateTopic) {
  return t.progress.for >= 80 && t.progress.against >= 80;
}

export const CORE_SKILLS_PROGRESS = 70; // %
