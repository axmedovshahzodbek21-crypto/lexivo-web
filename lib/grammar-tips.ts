export interface GrammarTip {
  id: string;
  title: string;
  category: string;
  categoryColor: string;
  icon: string;
  explanation: string;
  examples: { en: string; note?: string }[];
  remember: string;
  keywords: string[]; // matched against topic (case-insensitive)
}

export const GRAMMAR_TIPS: GrammarTip[] = [
  {
    id: 'collocations',
    title: 'Collocations',
    category: 'Vocabulary',
    categoryColor: '#6C63FF',
    icon: '🔗',
    explanation:
      'Collocations are words that naturally go together in English. Native speakers use specific combinations even when others seem logical. Learning collocations rather than individual words sounds more natural.',
    examples: [
      { en: 'make a decision ✓  /  do a decision ✗', note: 'make, not do' },
      { en: 'heavy rain ✓  /  strong rain ✗', note: 'heavy, not strong' },
      { en: 'take a photo ✓  /  do a photo ✗', note: 'take, not do' },
    ],
    remember: 'When you learn a new word, always learn its most common collocations too.',
    keywords: ['collocation', 'collocations', 'word mastery'],
  },
  {
    id: 'idioms',
    title: 'Idioms',
    category: 'Vocabulary',
    categoryColor: '#6C63FF',
    icon: '🎭',
    explanation:
      "Idioms are fixed phrases whose meaning can't be understood from the individual words. They are very common in spoken and informal English.",
    examples: [
      { en: '"Break a leg!" — means "Good luck!"' },
      { en: '"It\'s raining cats and dogs" — means it\'s raining heavily' },
      { en: '"Hit the books" — means to study' },
    ],
    remember: 'Never translate idioms word-by-word. Learn them as fixed units with their meaning.',
    keywords: ['idiom', 'idioms', 'phrase', 'phrases'],
  },
  {
    id: 'articles',
    title: 'Articles: a, an, the',
    category: 'Grammar',
    categoryColor: '#10B981',
    icon: '📌',
    explanation:
      'Use "a/an" for something mentioned for the first time or any one of many. Use "the" for something already known, specific, or unique. Use no article with plural/uncountable nouns in general statements.',
    examples: [
      { en: 'I saw a dog. The dog was barking.', note: 'first mention → a; known → the' },
      { en: 'The sun rises in the east.', note: 'unique things → the' },
      { en: 'Dogs are loyal animals.', note: 'general truth → no article' },
    ],
    remember: '"The" = we both know which one. "A/an" = any one, doesn\'t matter which.',
    keywords: ['society', 'education', 'language', 'culture'],
  },
  {
    id: 'countable',
    title: 'Countable & Uncountable Nouns',
    category: 'Grammar',
    categoryColor: '#10B981',
    icon: '🔢',
    explanation:
      'Countable nouns have a singular and plural form. Uncountable nouns have no plural and cannot be used with "a/an". Many nouns can be both — with a meaning change.',
    examples: [
      { en: 'Much information ✓  /  Many informations ✗', note: 'information = uncountable' },
      { en: 'I\'d like a coffee. (= a cup of coffee)', note: 'contextual countable' },
      { en: 'There are few opportunities here.', note: 'few = countable; little = uncountable' },
    ],
    remember: 'Use much/little with uncountable; many/few with countable.',
    keywords: ['food', 'diet', 'health', 'shopping'],
  },
  {
    id: 'present-tenses',
    title: 'Present Simple vs Continuous',
    category: 'Grammar',
    categoryColor: '#10B981',
    icon: '⏱️',
    explanation:
      'Present Simple is for habits, facts, and routines. Present Continuous is for actions happening right now or temporary situations.',
    examples: [
      { en: 'She works at a hospital. (permanent job)', note: 'simple = permanent' },
      { en: 'She\'s working from home this week.', note: 'continuous = temporary' },
      { en: 'Water boils at 100°C.', note: 'simple = scientific fact' },
    ],
    remember: 'State verbs (know, love, believe, own) don\'t use continuous form.',
    keywords: ['work', 'employment', 'routine', 'lifestyle'],
  },
  {
    id: 'past-tenses',
    title: 'Past Simple vs Past Perfect',
    category: 'Grammar',
    categoryColor: '#10B981',
    icon: '⏪',
    explanation:
      'Past Simple describes completed actions in the past. Past Perfect (had + past participle) describes an action completed before another past action.',
    examples: [
      { en: 'I arrived and then she left.', note: 'two sequential past actions' },
      { en: 'She had already left when I arrived.', note: 'she left first → past perfect' },
      { en: 'By 2010, they had built 50 schools.', note: 'completed before a point in the past' },
    ],
    remember: 'Past Perfect = the "earlier" of two past events. Use "by the time", "already", "before".',
    keywords: ['history', 'heritage', 'cultural', 'ageing', 'population'],
  },
  {
    id: 'modal-verbs',
    title: 'Modal Verbs',
    category: 'Grammar',
    categoryColor: '#10B981',
    icon: '🎛️',
    explanation:
      'Modal verbs (can, could, should, must, might, may, would) add meaning like ability, possibility, obligation, or permission. They are followed by the base form of the verb.',
    examples: [
      { en: 'You must wear a seatbelt. (obligation)', note: 'must = strong obligation' },
      { en: 'You should eat more vegetables.', note: 'should = advice' },
      { en: 'It might rain tomorrow.', note: 'might = weak possibility' },
    ],
    remember: '"Must" = obligation from the speaker. "Have to" = obligation from rules/outside.',
    keywords: ['crime', 'punishment', 'law', 'government', 'privacy', 'security'],
  },
  {
    id: 'passive',
    title: 'Passive Voice',
    category: 'Grammar',
    categoryColor: '#10B981',
    icon: '🔄',
    explanation:
      'The passive voice is formed with be + past participle. Use it when the action is more important than who does it, or when the agent is unknown.',
    examples: [
      { en: 'The report was written by the team.', note: 'active: The team wrote the report' },
      { en: 'Mistakes were made.', note: 'agent unknown/unimportant' },
      { en: 'The new law will be introduced next year.', note: 'future passive' },
    ],
    remember: 'Passive is common in formal, scientific, and news writing.',
    keywords: ['science', 'research', 'technology', 'artificial intelligence', 'space'],
  },
  {
    id: 'conditionals',
    title: 'Conditionals',
    category: 'Grammar',
    categoryColor: '#10B981',
    icon: '🔀',
    explanation:
      'English has four main conditionals. Zero = always true. First = real/likely future. Second = unreal/hypothetical present. Third = impossible past.',
    examples: [
      { en: 'If you heat ice, it melts. (zero)', note: 'general truth' },
      { en: 'If it rains, I\'ll stay home. (first)', note: 'likely future' },
      { en: 'If I were rich, I\'d travel. (second)', note: 'unreal present' },
    ],
    remember: 'Second conditional: always "were" (not "was") in formal writing — "If I were you…"',
    keywords: ['climate', 'environment', 'renewable energy', 'pollution'],
  },
  {
    id: 'gerunds-infinitives',
    title: 'Gerunds vs Infinitives',
    category: 'Grammar',
    categoryColor: '#10B981',
    icon: '⚖️',
    explanation:
      'Some verbs are followed by gerund (-ing), some by infinitive (to + verb), and some by either with a meaning change.',
    examples: [
      { en: 'She enjoys swimming. (enjoy + gerund)', note: 'enjoy always takes gerund' },
      { en: 'He decided to leave. (decide + infinitive)', note: 'decide always takes infinitive' },
      { en: 'I stopped to rest. / I stopped resting.', note: 'stop changes meaning!' },
    ],
    remember: 'Stop/remember/try/forget change meaning with gerund vs infinitive.',
    keywords: ['sport', 'sports', 'fitness', 'tourism', 'travel', 'hobby'],
  },
  {
    id: 'relative-clauses',
    title: 'Relative Clauses',
    category: 'Grammar',
    categoryColor: '#10B981',
    icon: '🔍',
    explanation:
      'Defining relative clauses identify which person/thing you mean (no commas). Non-defining clauses add extra info about something already identified (use commas).',
    examples: [
      { en: 'The man who called was my uncle.', note: 'defining — tells us which man' },
      { en: 'My uncle, who lives in London, called.', note: 'non-defining — extra info' },
      { en: 'The book that I bought was excellent.', note: 'that = defining only' },
    ],
    remember: '"That" can only be used in defining clauses, never non-defining.',
    keywords: ['family', 'parenting', 'social', 'gender', 'community'],
  },
  {
    id: 'word-formation',
    title: 'Word Formation',
    category: 'Vocabulary',
    categoryColor: '#6C63FF',
    icon: '🏗️',
    explanation:
      'English builds new words using prefixes (before the root) and suffixes (after the root). Knowing common affixes dramatically expands your vocabulary.',
    examples: [
      { en: 'un- + happy = unhappy (negative prefix)', note: 'un-, dis-, in-, im-, ir-' },
      { en: 'employ + -ment = employment (noun suffix)', note: '-ment, -tion, -ness, -ity' },
      { en: 'beauty + -ful = beautiful (adjective suffix)', note: '-ful, -less, -ous, -able' },
    ],
    remember: 'Learn word families: employ → employee, employer, employment, unemployed.',
    keywords: ['language learning', 'education', 'learning', 'vocabulary'],
  },
  {
    id: 'prepositions-time',
    title: 'Prepositions of Time',
    category: 'Grammar',
    categoryColor: '#10B981',
    icon: '🕐',
    explanation:
      'AT is for precise times and fixed expressions. ON is for days and dates. IN is for longer periods like months, years, and seasons.',
    examples: [
      { en: 'at 3pm · at midnight · at Christmas', note: 'at = precise point' },
      { en: 'on Monday · on 15 June · on my birthday', note: 'on = specific day/date' },
      { en: 'in July · in 2024 · in the morning', note: 'in = longer period' },
    ],
    remember: 'No preposition before "last", "next", "this", "every": "I\'ll see you next Friday."',
    keywords: ['work', 'employment', 'routine', 'scheduling', 'ageing'],
  },
  {
    id: 'prepositions-place',
    title: 'Prepositions of Place',
    category: 'Grammar',
    categoryColor: '#10B981',
    icon: '📍',
    explanation:
      'AT indicates a general location or point. IN indicates being inside/enclosed. ON indicates a surface or position.',
    examples: [
      { en: 'at the station · at school · at home', note: 'at = general point' },
      { en: 'in the car · in London · in my pocket', note: 'in = enclosed/inside' },
      { en: 'on the table · on the wall · on the bus', note: 'on = surface/transport' },
    ],
    remember: 'We say "in" a car/taxi but "on" a bus/train/plane.',
    keywords: ['urbanization', 'transportation', 'tourism', 'travel', 'city'],
  },
  {
    id: 'phrasal-verbs',
    title: 'Phrasal Verbs',
    category: 'Vocabulary',
    categoryColor: '#6C63FF',
    icon: '🔧',
    explanation:
      'Phrasal verbs combine a verb + particle(s) to create a new meaning. They are extremely common in informal English and often have surprising meanings.',
    examples: [
      { en: 'give up = quit/stop trying', note: 'not "give" + "up" literally' },
      { en: 'run into = meet unexpectedly', note: '"into" changes the meaning' },
      { en: 'look up to = admire', note: 'completely different from "look up"' },
    ],
    remember: 'Some phrasal verbs are separable ("turn it off") and some are not ("run into him").',
    keywords: ['phrase', 'phrases', 'work', 'technology', 'media'],
  },
  {
    id: 'adjective-order',
    title: 'Adjective Order',
    category: 'Grammar',
    categoryColor: '#10B981',
    icon: '📐',
    explanation:
      'When using multiple adjectives before a noun, English follows a strict order: Opinion → Size → Age → Shape → Color → Origin → Material → Purpose.',
    examples: [
      { en: 'a lovely little old rectangular green French silver whittling knife', note: 'all 8 categories' },
      { en: 'a beautiful young Italian woman ✓', note: 'opinion before origin' },
      { en: 'a wooden large table ✗  →  a large wooden table ✓', note: 'size before material' },
    ],
    remember: 'In practice, 2-3 adjectives maximum. The order feels natural once you memorize it.',
    keywords: ['art', 'music', 'fashion', 'trends', 'beauty'],
  },
  {
    id: 'reported-speech',
    title: 'Reported Speech',
    category: 'Grammar',
    categoryColor: '#10B981',
    icon: '💬',
    explanation:
      'When reporting what someone said, verbs shift back one tense (backshift). Present → Past, Past → Past Perfect. Time expressions also change.',
    examples: [
      { en: '"I am tired." → She said she was tired.', note: 'am → was (backshift)' },
      { en: '"I will call." → He said he would call.', note: 'will → would' },
      { en: '"I\'ve finished." → She said she had finished.', note: 'present perfect → past perfect' },
    ],
    remember: 'No backshift needed if reporting immediately after or if the fact is still true.',
    keywords: ['media', 'advertising', 'social media', 'news', 'communication'],
  },
  {
    id: 'quantifiers',
    title: 'Quantifiers',
    category: 'Grammar',
    categoryColor: '#10B981',
    icon: '🔢',
    explanation:
      'Quantifiers express amounts. Some work only with countable, some only with uncountable, and some with both.',
    examples: [
      { en: 'many students / much time', note: 'many=countable, much=uncountable' },
      { en: 'few friends (= not many) / a few friends (= some)', note: 'few vs a few' },
      { en: 'a lot of + both · some/any + both', note: 'neutral quantifiers' },
    ],
    remember: '"Few/little" = negative (not enough). "A few/a little" = positive (some, enough).',
    keywords: ['population', 'globalization', 'immigration', 'food', 'resources'],
  },
  {
    id: 'comparatives',
    title: 'Comparatives & Superlatives',
    category: 'Grammar',
    categoryColor: '#10B981',
    icon: '📊',
    explanation:
      'Short adjectives add -er/-est. Long adjectives (2+ syllables) use more/most. Irregular forms must be memorized.',
    examples: [
      { en: 'fast → faster → fastest', note: 'one syllable: add -er/-est' },
      { en: 'expensive → more expensive → most expensive', note: 'long adjective: more/most' },
      { en: 'good → better → best · bad → worse → worst', note: 'irregular forms' },
    ],
    remember: 'Double the final consonant: big → bigger, hot → hotter, thin → thinner.',
    keywords: ['economics', 'business', 'spending', 'health', 'sport', 'sports', 'competition'],
  },
  {
    id: 'cohesive-devices',
    title: 'Cohesive Devices',
    category: 'Writing',
    categoryColor: '#F59E0B',
    icon: '🔗',
    explanation:
      'Linking words connect ideas and make your writing flow. They show relationship: addition, contrast, cause/effect, sequence, or concession.',
    examples: [
      { en: 'Furthermore / Moreover / In addition — adding ideas', note: 'addition' },
      { en: 'However / Nevertheless / Although — contrast', note: 'contrast' },
      { en: 'Therefore / As a result / Consequently — cause/effect', note: 'result' },
    ],
    remember: 'Don\'t overuse "and", "but", "so". Replace with formal connectors in academic writing.',
    keywords: ['writing', 'essay', 'academic', 'language', 'education', 'research'],
  },
];

// Pick a tip for a given topic + unit number
export function getTipForUnit(topic: string, dayNumber: number): GrammarTip {
  const lower = topic.toLowerCase();

  // First try keyword match
  const matched = GRAMMAR_TIPS.find(t =>
    t.keywords.some(kw => lower.includes(kw.toLowerCase()))
  );
  if (matched) return matched;

  // Fallback: rotate through all tips by day number
  return GRAMMAR_TIPS[dayNumber % GRAMMAR_TIPS.length];
}

export function getTipById(id: string): GrammarTip | undefined {
  return GRAMMAR_TIPS.find(t => t.id === id);
}

export const TIP_CATEGORIES = [...new Set(GRAMMAR_TIPS.map(t => t.category))];
