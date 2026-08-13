// ─── Types ───────────────────────────────────────────────────────────────────

export type QuestionType =
  | 'multiple_choice'          // Pick one answer from 4 options
  | 'multiple_choice_multi'    // Select multiple correct answers from a list
  | 'true_false_not_given'     // TRUE / FALSE / NOT GIVEN (facts)
  | 'yes_no_not_given'         // YES / NO / NOT GIVEN (writer's views/opinions)
  | 'matching_information'     // Which paragraph contains this information?
  | 'matching_headings'        // Match headings to paragraphs
  | 'matching_features'        // Match items to a list of options (e.g. researcher → finding)
  | 'matching_sentence_endings'// Choose the correct sentence ending from a list
  | 'sentence_completion'      // Fill in gaps using words from the passage
  | 'summary_completion'       // Fill in gaps in a summary
  | 'short_answer';            // Answer in a strict word limit

export interface IeltsQuestion {
  type: QuestionType;
  question: string;       // The question or statement text
  options?: string[];     // For multiple choice / matching types — the list of choices
  answer: string;         // The correct answer (exact text or option letter e.g. "A", "TRUE", "paragraph C")
  passage_excerpt: string;// The quote from the passage that supports this answer
  explanation: string;    // Why this is the correct answer
}

export interface IeltsPassage {
  passageNumber: 1 | 2 | 3;
  title: string;
  content: string;        // Full passage text — use template literals (backticks)
  questions: IeltsQuestion[];
}

export interface IeltsTest {
  testNumber: number;
  passages: IeltsPassage[];
}

// ─── Data ────────────────────────────────────────────────────────────────────

export const ieltsTests: IeltsTest[] = [

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 1
  // ═══════════════════════════════════════════════════════════════════════════
  {
    testNumber: 1,
    passages: [

      // ── Passage 1 ──────────────────────────────────────────────────────────
      {
        passageNumber: 1,
        title: 'Your Passage Title Here',
        content: `Paste the full passage text here.

Use a new line for each paragraph.

The backtick string preserves line breaks automatically.`,

        questions: [

          // ── TRUE / FALSE / NOT GIVEN ──────────────────────────────────────
          {
            type: 'true_false_not_given',
            question: 'Paste the statement here (e.g. "Wooden houses were considered safer than brick houses.").',
            answer: 'TRUE',                  // TRUE | FALSE | NOT GIVEN
            passage_excerpt: 'Paste the sentence(s) from the passage that support this answer.',
            explanation: 'Explain why the answer is TRUE/FALSE/NOT GIVEN based on the excerpt.',
          },

          // ── YES / NO / NOT GIVEN ──────────────────────────────────────────
          {
            type: 'yes_no_not_given',
            question: 'Paste the statement about the writer\'s view or opinion here.',
            answer: 'YES',                   // YES | NO | NOT GIVEN
            passage_excerpt: 'Paste the sentence(s) from the passage.',
            explanation: 'Explain why the answer is YES/NO/NOT GIVEN.',
          },

          // ── MULTIPLE CHOICE (one answer) ──────────────────────────────────
          {
            type: 'multiple_choice',
            question: 'What is the main purpose of this passage?',
            options: [
              'A. To argue that ...',
              'B. To describe how ...',
              'C. To explain why ...',
              'D. To compare ...',
            ],
            answer: 'B',                     // A | B | C | D
            passage_excerpt: 'Paste the supporting sentence(s) from the passage.',
            explanation: 'Explain why B is correct and the others are not.',
          },

          // ── MULTIPLE CHOICE (multiple answers) ────────────────────────────
          {
            type: 'multiple_choice_multi',
            question: 'Which TWO of the following are mentioned in the passage?',
            options: [
              'A. ...',
              'B. ...',
              'C. ...',
              'D. ...',
              'E. ...',
            ],
            answer: 'A, C',                  // e.g. "A, C" or "B, E"
            passage_excerpt: 'Paste the supporting sentence(s) for both correct answers.',
            explanation: 'Explain why A and C are correct.',
          },

          // ── MATCHING INFORMATION (which paragraph?) ───────────────────────
          {
            type: 'matching_information',
            question: 'A reference to the negative effects of economic growth on the environment.',
            options: [
              'A', 'B', 'C', 'D', 'E', 'F', // paragraph letters
            ],
            answer: 'C',                     // The paragraph letter
            passage_excerpt: 'Paste the sentence from that paragraph.',
            explanation: 'Explain why this information appears in paragraph C.',
          },

          // ── MATCHING HEADINGS ─────────────────────────────────────────────
          {
            type: 'matching_headings',
            question: 'Paragraph 3',         // Which heading matches this paragraph?
            options: [
              'i. The origins of the problem',
              'ii. A surprising discovery',
              'iii. Government intervention',
              'iv. Early solutions',
              'v. The impact on local communities',
            ],
            answer: 'ii',                    // The roman numeral
            passage_excerpt: 'Paste the key sentence(s) from that paragraph.',
            explanation: 'Explain why "A surprising discovery" fits paragraph 3.',
          },

          // ── MATCHING FEATURES ─────────────────────────────────────────────
          {
            type: 'matching_features',
            question: 'Found that regular exercise improves memory retention.',
            options: [
              'A. Dr Smith',
              'B. Professor Yuen',
              'C. Dr Patel',
            ],
            answer: 'B',                     // The matching option
            passage_excerpt: 'Paste the sentence attributing this finding to the correct person.',
            explanation: 'Explain how the passage links this finding to Professor Yuen.',
          },

          // ── MATCHING SENTENCE ENDINGS ─────────────────────────────────────
          {
            type: 'matching_sentence_endings',
            question: 'The government decided to invest in renewable energy because ...',
            options: [
              'A. ... fossil fuel prices had fallen significantly.',
              'B. ... public pressure had been building for years.',
              'C. ... new technology made it cost-effective.',
              'D. ... international agreements required it.',
            ],
            answer: 'C',
            passage_excerpt: 'Paste the sentence from the passage.',
            explanation: 'Explain why option C correctly completes the sentence.',
          },

          // ── SENTENCE COMPLETION ───────────────────────────────────────────
          {
            type: 'sentence_completion',
            question: 'The ancient city was abandoned due to a prolonged ______.',
            // No options — answer comes directly from the passage text
            answer: 'drought',               // The exact word(s) from the passage
            passage_excerpt: 'Paste the sentence from the passage containing the answer word.',
            explanation: 'The word "drought" appears directly in the passage as the cause of abandonment.',
          },

          // ── SUMMARY COMPLETION ────────────────────────────────────────────
          {
            type: 'summary_completion',
            question: 'Solar panels work by converting ______ into electricity using photovoltaic cells.',
            // options only needed if the question provides a word box
            options: ['sunlight', 'heat', 'wind', 'water', 'pressure'],
            answer: 'sunlight',
            passage_excerpt: 'Paste the sentence from the passage.',
            explanation: 'The passage states that photovoltaic cells convert sunlight into electricity.',
          },

          // ── SHORT ANSWER ──────────────────────────────────────────────────
          {
            type: 'short_answer',
            question: 'What material was used to build the original bridge? (ONE WORD)',
            answer: 'timber',                // The exact answer, max words as stated in question
            passage_excerpt: 'Paste the sentence from the passage.',
            explanation: 'The passage explicitly states the bridge was constructed from timber.',
          },

        ],
      },

      // ── Passage 2 ──────────────────────────────────────────────────────────
      {
        passageNumber: 2,
        title: 'Your Passage 2 Title Here',
        content: `Paste passage 2 content here.`,
        questions: [
          // Add questions following the same patterns above
        ],
      },

      // ── Passage 3 ──────────────────────────────────────────────────────────
      {
        passageNumber: 3,
        title: 'Your Passage 3 Title Here',
        content: `Paste passage 3 content here.`,
        questions: [
          // Add questions following the same patterns above
        ],
      },

    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 2 — copy the block above and change testNumber to 2
  // ═══════════════════════════════════════════════════════════════════════════

];
