// Shared types for Battle-Ready topic content. One file per topic lives in
// ./topics/<slug>.json — a plain JSON value (either `null` for an unfilled
// topic, or an object matching BRTopicContent). See index.ts for assembly.

export type BRSide = 'for' | 'against';

export type BRVocabItem = { term: string; definition: string; example: string };
export type BRPhraseItem = { phrase: string; examples: string[] }; // 3+ examples
export type BRIdiomItem = { idiom: string; definition: string; examples: string[] }; // 3+ examples
export type BRArgumentItem = { claim: string; explanation: string }; // 150-200+ words

export type BRSideContent = {
  vocab: BRVocabItem[];
  phrases: BRPhraseItem[];
  idioms: BRIdiomItem[];
  arguments: BRArgumentItem[];
};

export type BRTopicContent = {
  motion?: string;
  for: BRSideContent;
  against: BRSideContent;
};
