// ─── Types ───────────────────────────────────────────────────────────────────

export type QuestionType =
  | 'multiple_choice'
  | 'multiple_choice_multi'
  | 'true_false_not_given'
  | 'yes_no_not_given'
  | 'matching_information'
  | 'matching_headings'
  | 'matching_features'
  | 'matching_sentence_endings'
  | 'sentence_completion'
  | 'summary_completion'
  | 'short_answer';

export interface IeltsQuestion {
  type: QuestionType;
  question: string;
  options?: string[];
  answer: string;
  passage_excerpt: string;
  explanation: string;
}

export interface IeltsPassageTest {
  testNumber: number;
  title: string;
  content: string;
  questions: IeltsQuestion[];
}

export interface IeltsPassageSection {
  passageSection: 1 | 2 | 3;
  tests: IeltsPassageTest[];
}

// ─── Data ────────────────────────────────────────────────────────────────────

export const ieltsData: IeltsPassageSection[] = [

  // ═══════════════════════════════════════════════════════════════════════════
  // PASSAGE 1 — all "first passages" from every test
  // ═══════════════════════════════════════════════════════════════════════════
  {
    passageSection: 1,
    tests: [

      // ── Test 1 ─────────────────────────────────────────────────────────────
      {
        testNumber: 1,
        title: 'Your Title Here',
        content: `Paste the full passage text here.

New paragraph here.`,
        questions: [
          // Paste the AI-generated questions here
        ],
      },

      // ── Test 2 ─────────────────────────────────────────────────────────────
      // {
      //   testNumber: 2,
      //   title: '...',
      //   content: `...`,
      //   questions: [],
      // },

    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PASSAGE 2 — all "second passages" from every test
  // ═══════════════════════════════════════════════════════════════════════════
  {
    passageSection: 2,
    tests: [

      // ── Test 1 ─────────────────────────────────────────────────────────────
      // {
      //   testNumber: 1,
      //   title: '...',
      //   content: `...`,
      //   questions: [],
      // },

    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PASSAGE 3 — all "third passages" from every test
  // ═══════════════════════════════════════════════════════════════════════════
  {
    passageSection: 3,
    tests: [

      // ── Test 1 ─────────────────────────────────────────────────────────────
      // {
      //   testNumber: 1,
      //   title: '...',
      //   content: `...`,
      //   questions: [],
      // },

    ],
  },

];
