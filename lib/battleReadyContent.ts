// Public API for Battle-Ready content. The actual data now lives in
// ./battle-ready-content/topics/<slug>.json — one plain-JSON file per topic,
// so you can open a single topic and paste an AI tool's output into it
// without touching anything else. This file just re-exports so existing
// imports keep working.

export type { BRSide, BRVocabItem, BRPhraseItem, BRIdiomItem, BRArgumentItem, BRSideContent, BRTopicContent } from './battle-ready-content/types';
export { BATTLE_READY_CONTENT, getBRSideContent } from './battle-ready-content/index';
