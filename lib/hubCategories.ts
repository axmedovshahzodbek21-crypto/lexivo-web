export type HubCategoryKey = 'practice' | 'vocabulary' | 'reading' | 'listen-speak' | 'progress';

export type HubItem = {
  key: string;
  href: string;
  icon: string;
  gradient: string;
  edge: string;
  glow: string;
};

export type HubCategory = {
  key: HubCategoryKey;
  icon: string;
  gradient: string;
  edge: string;
  glow: string;
  items: HubItem[];
};

export const HUB_CATEGORIES: HubCategory[] = [
  {
    key: 'practice', icon: '🎯',
    gradient: 'linear-gradient(135deg, #4338ca, #818cf8)', edge: '#312e81', glow: 'rgba(67,56,202,0.4)',
    items: [
      { key: 'learn',      href: '/learn',      icon: '📖', gradient: 'linear-gradient(135deg, #4338ca, #818cf8)', edge: '#312e81', glow: 'rgba(67,56,202,0.4)' },
      { key: 'srs',        href: '/srs',        icon: '🔄', gradient: 'linear-gradient(135deg, #ef4444, #f87171)', edge: '#b91c1c', glow: 'rgba(239,68,68,0.4)' },
      { key: 'flashcards', href: '/flashcards', icon: '🃏', gradient: 'linear-gradient(135deg, #b45309, #fcd34d)', edge: '#78350f', glow: 'rgba(180,83,9,0.4)' },
      { key: 'quiz',       href: '/quiz',       icon: '❓', gradient: 'linear-gradient(135deg, #4d7c0f, #a3e635)', edge: '#365314', glow: 'rgba(77,124,15,0.4)' },
      { key: 'match',      href: '/matching',   icon: '🎯', gradient: 'linear-gradient(135deg, #ec4899, #f472b6)', edge: '#9d174d', glow: 'rgba(236,72,153,0.4)' },
      { key: 'pomodoro',   href: '/pomodoro',   icon: '🍅', gradient: 'linear-gradient(135deg, #7f1d1d, #b91c1c)', edge: '#450a0a', glow: 'rgba(127,29,29,0.4)' },
    ],
  },
  {
    key: 'vocabulary', icon: '🗂️',
    gradient: 'linear-gradient(135deg, #0d9488, #2dd4bf)', edge: '#115e59', glow: 'rgba(13,148,136,0.4)',
    items: [
      { key: 'collections',    href: '/collections',   icon: '🗂️', gradient: 'linear-gradient(135deg, #1d4ed8, #60a5fa)', edge: '#1e3a8a', glow: 'rgba(29,78,216,0.4)' },
      { key: 'my_words',       href: '/my-words',      icon: '📁', gradient: 'linear-gradient(135deg, #0d9488, #2dd4bf)', edge: '#115e59', glow: 'rgba(13,148,136,0.4)' },
      { key: 'leveled_words',  href: '/leveled-words', icon: '🪜', gradient: 'linear-gradient(135deg, #7e22ce, #c084fc)', edge: '#581c87', glow: 'rgba(126,34,206,0.4)' },
      { key: 'lists',          href: '/lists',         icon: '📋', gradient: 'linear-gradient(135deg, #7c3aed, #8b5cf6)', edge: '#4c1d95', glow: 'rgba(124,58,237,0.4)' },
      { key: 'starred',        href: '/starred',       icon: '⭐', gradient: 'linear-gradient(135deg, #92400e, #d97706)', edge: '#451a03', glow: 'rgba(146,64,14,0.4)' },
      { key: 'hard_words',     href: '/hard-words',    icon: '😓', gradient: 'linear-gradient(135deg, #dc2626, #ef4444)', edge: '#991b1b', glow: 'rgba(220,38,38,0.4)' },
      { key: 'library',        href: '/library',       icon: '📚', gradient: 'linear-gradient(135deg, #4d7c0f, #a3e635)', edge: '#365314', glow: 'rgba(77,124,15,0.4)' },
      { key: 'import_words',   href: '/import',        icon: '📥', gradient: 'linear-gradient(135deg, #0f766e, #5eead4)', edge: '#134e4a', glow: 'rgba(15,118,110,0.4)' },
    ],
  },
  {
    key: 'reading', icon: '💡',
    gradient: 'linear-gradient(135deg, #047857, #34d399)', edge: '#064e3b', glow: 'rgba(4,120,87,0.4)',
    items: [
      { key: 'reading',       href: '/reading',       icon: '💡', gradient: 'linear-gradient(135deg, #047857, #34d399)', edge: '#064e3b', glow: 'rgba(4,120,87,0.4)' },
      { key: 'free_reading',  href: '/reading/free',  icon: '📖', gradient: 'linear-gradient(135deg, #854d0e, #fde047)', edge: '#713f12', glow: 'rgba(133,77,14,0.4)' },
      { key: 'ielts_reading', href: '/ielts-reading', icon: '📝', gradient: 'linear-gradient(135deg, #4f46e5, #a5b4fc)', edge: '#3730a3', glow: 'rgba(79,70,229,0.4)' },
    ],
  },
  {
    key: 'listen-speak', icon: '🗣️',
    gradient: 'linear-gradient(135deg, #be185d, #fb7185)', edge: '#831843', glow: 'rgba(190,24,93,0.4)',
    items: [
      { key: 'real_english', href: '/real-english', icon: '🗣️', gradient: 'linear-gradient(135deg, #0e7490, #06b6d4)', edge: '#164e63', glow: 'rgba(14,116,144,0.4)' },
      { key: 'speaking',     href: '/speaking',     icon: '🎤', gradient: 'linear-gradient(135deg, #be185d, #fb7185)', edge: '#831843', glow: 'rgba(190,24,93,0.4)' },
    ],
  },
  {
    key: 'progress', icon: '📊',
    gradient: 'linear-gradient(135deg, #d97706, #fbbf24)', edge: '#92400e', glow: 'rgba(217,119,6,0.4)',
    items: [
      { key: 'progress',     href: '/progress',     icon: '📊', gradient: 'linear-gradient(135deg, #059669, #34d399)', edge: '#065f46', glow: 'rgba(5,150,105,0.4)' },
      { key: 'achievements', href: '/achievements', icon: '🏅', gradient: 'linear-gradient(135deg, #d97706, #fbbf24)', edge: '#92400e', glow: 'rgba(217,119,6,0.4)' },
      { key: 'leaderboard',  href: '/leaderboard',  icon: '🏆', gradient: 'linear-gradient(135deg, #b45309, #fcd34d)', edge: '#78350f', glow: 'rgba(180,83,9,0.4)' },
      { key: 'grammar',      href: '/grammar-tips', icon: '📚', gradient: 'linear-gradient(135deg, #1a9a50, #2ECC71)', edge: '#0f6634', glow: 'rgba(46,204,113,0.4)' },
      { key: 'structures',   href: '/structures',   icon: '🧩', gradient: 'linear-gradient(135deg, #7c2d92, #c026d3)', edge: '#581c62', glow: 'rgba(192,38,211,0.4)' },
      { key: 'xp_history',   href: '#xp-history',   icon: '📅', gradient: 'linear-gradient(135deg, #4c1d95, #6c63ff)', edge: '#2e1065', glow: 'rgba(108,99,255,0.4)' },
    ],
  },
];

export const getHubCategory = (key: string) => HUB_CATEGORIES.find(c => c.key === key);
