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
  paragraphLabels?: string;  // e.g. "A–G" for matching_information
  featureListTitle?: string; // e.g. "List of People" for matching_features
}

export interface IeltsPassageTest {
  testNumber: number;
  title: string;
  subtitle?: string;      // italic byline under the title, e.g. "Mark Rowe investigates..."
  questionRange?: string; // e.g. "1-13" or "14-26", for the time instruction header
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
  title: 'Wood: a valuable resource in New Zealand\'s economy',
  questionRange: '1–13',
  content: `During the settlement of New Zealand by European immigrants, natural timbers played a major role. Wood was easily accessible and relatively cheap. A tradition of wooden houses arose, supported by the recognition that they were less likely to collapse suddenly during earthquakes, a not infrequent event in this part of the world.

But in addition to demand from the domestic market, there was also a demand for forest products from overseas. Early explorers recognised the suitability of the tall, straight trunks of the kauri for constructing sailing vessels. The kauri is a species of coniferous tree found only in small areas of the southern hemisphere. So from the early 1800s, huge amounts of this type of wood were sold to Australia and the UK for that purpose.

For a period, the forestry industry was the country’s major export earner, but the rate of harvest was unsustainable and, by the beginning of the 20th century, indigenous timber exports were rapidly declining. From the 1940s, newly established plantations of an imported species of tree called radiata pine supplied timber and other wood products in increasing quantities. By the 1960s, plantation-grown timber was providing most of the country’s sawn timber needs, especially for construction. Today, less than two percent of timber is cut from indigenous forests, and almost all of that is used for higher-value end uses, such as furniture and fittings.

As the pine industry developed, it became apparent that this type of wood was also well suited for many uses. It makes excellent pulp*, and is frequently used for posts, poles, furnishings and mouldings, particleboard, fibreboard, and for plywood and 'engineered' wood products. Pine by-products are used in the chemical and pharmaceutical industries and residues are consumed for fuel. This amazing versatility has encouraged the development of an integrated forest-products industry which is almost unique in the world.

Exporters of wood products have largely targeted the rapidly growing markets of South and East Asia and Australia 80 percent of exports by value go to only five markets: Japan, Korea, China, the United States and Australia. The product mix remains heavily based on raw materials, with logs, sawn wood, pulp and paper comprising 75 percent of export value. However, finished wood products such as panels and furniture components are exported to more than 50 countries.

In New Zealand itself, the construction industry is the principal user of solid wood products, servicing around 20,000 new house starts annually. However, the small size of New Zealand’s population (just over four million), plus its small manufacturing and remanufacturing base, limit the forestry industry’s domestic opportunities. For the last few years local wood consumption has been around only four million cubic metres.

Accordingly, the development of the export market is the key to the industry’s growth and contribution to the national economy in decades to come. In 2004, forestry export receipts were about 11 percent of the country’s total export income, their value having increased steadily for ten years, until affected by the exchange fluctuations and shipping costs of recent years.

The forestry industry is New Zealand’s third largest export sector, generating around $3.3 billion annually from logs and processed wood products. But it is generally agreed that it is operating well below its capacity and, with the domestic market already at its peak, almost all of the extra wood produced in future will have to be marketed overseas.

That presents a major marketing challenge for the industry. Although the export of logs will continue to provide valuable earnings for forest owners, there is broad acceptance that the industry must be based on value-added products in future. So the industry is investigating various processing, infrastructure and investment strategies with a view to increasing the level of local manufacturing before export.

The keys to future success will depend on a variety of factor, better international marketing, product innovation, internationally competitive processing, better infrastructure and a suitable political, regulatory and investment environment. The industry claims that, given the right conditions, by 2025 the forestry sector could be the country’s biggest export earner, generating $20 billion a year and employing 60,000 people.

One competitive advantage that New Zealand has is its ability to source large quantities of softwood from renewable forests. Consumers in several key wood markets are becoming more worried about sustainability, and the industry is supporting the development of national standards as well as the recognition of these internationally.

However, New Zealand is not the only country with a plantation-style forestry industry, Chile, Brazil, Argentina, South Africa and Australia all have extensive plantings of fast-growing species (hardwood and softwood), and in the northern hemisphere, Scandinavian countries have all expanded their forests or controlled their use in the interests of future production.

Finally, in addition to competition from other wood producers, New Zealand faces competition from goods such as wood substitutes. These include steel framing for houses. This further underlines the necessity for globally competitive production and marketing strategies.

pulp*: wood which is crushed until soft enough to form the basis of paper.`,
  questions: [
    {
      type: 'true_false_not_given',
      question: 'Settlers realised that wooden houses were more dangerous than other types of structure.',
      answer: 'FALSE',
      passage_excerpt: 'A tradition of wooden houses arose, supported by the recognition that they were less likely to collapse suddenly during earthquakes…',
      explanation: 'The passage says settlers recognised that wooden houses were less likely to collapse in earthquakes, not more dangerous.',
    },
    {
      type: 'true_false_not_given',
      question: 'During the 1800s, New Zealand exported wood for use in boat-building.',
      answer: 'TRUE',
      passage_excerpt: 'Early explorers recognised the suitability of the tall, straight trunks of the kauri for constructing sailing vessels. … So from the early 1800s, huge amounts of this type of wood were sold to Australia and the UK for that purpose.',
      explanation: 'Kauri wood was exported from the early 1800s specifically for building sailing vessels.',
    },
    {
      type: 'true_false_not_given',
      question: 'Plantation-grown wood is generally better for construction than native forest wood.',
      answer: 'NOT GIVEN',
      passage_excerpt: 'By the 1960s, plantation-grown timber was providing most of the country’s sawn timber needs, especially for construction. Today, less than two percent of timber is cut from indigenous forests, and almost all of that is used for higher-value end uses, such as furniture and fittings.',
      explanation: 'The text states that plantation timber now supplies most construction needs and that remaining indigenous timber is used for higher-value products (furniture, fittings). It does not compare which is “generally better” for construction.',
    },
    {
      type: 'true_false_not_given',
      question: 'Compared to other types of wood, pine has a narrow range of uses.',
      answer: 'FALSE',
      passage_excerpt: 'It makes excellent pulp, and is frequently used for posts, poles, furnishings and mouldings, particleboard, fibreboard, and for plywood and ‘engineered’ wood products. … This amazing versatility has encouraged the development of an integrated forest-products industry…',
      explanation: 'Pine is described as having “amazing versatility” and a wide range of uses.',
    },
    {
      type: 'true_false_not_given',
      question: 'Demand for housing in New Zealand is predicted to fall in the next few years.',
      answer: 'NOT GIVEN',
      passage_excerpt: '…servicing around 20,000 new house starts annually. … For the last few years local wood consumption has been around only four million cubic metres.',
      explanation: 'The passage mentions current housing starts (around 20,000 annually) and limited domestic demand, but gives no prediction that demand will fall.',
    },
    {
      type: 'true_false_not_given',
      question: 'In future, the expansion of New Zealand\'s wood industry will depend on its exports.',
      answer: 'TRUE',
      passage_excerpt: 'Accordingly, the development of the export market is the key to the industry’s growth and contribution to the national economy in decades to come. … with the domestic market already at its peak, almost all of the extra wood produced in future will have to be marketed overseas.',
      explanation: 'Future growth depends on exports because the domestic market is already at its peak.',
    },
    {
      type: 'short_answer',
      question: 'Apart from exchange rates, which factor has had a negative impact on New Zealand\'s forestry exports?',
      answer: 'shipping costs',
      passage_excerpt: '…until affected by the exchange fluctuations and shipping costs of recent years.',
      explanation: 'The passage identifies shipping costs (alongside exchange fluctuations) as a factor that negatively affected forestry export receipts.',
    },
    {
      type: 'short_answer',
      question: 'Which part of New Zealand\'s economy does the forestry industry rank third in?',
      answer: 'export sector',
      passage_excerpt: 'The forestry industry is New Zealand’s third largest export sector…',
      explanation: 'The text explicitly states that the forestry industry is New Zealand’s third largest export sector.',
    },
    {
      type: 'short_answer',
      question: 'According to the New Zealand forestry industry, what could be the size of its workforce by 2025?',
      answer: '60,000',
      passage_excerpt: '…by 2025 the forestry sector could be the country’s biggest export earner, generating $20 billion a year and employing 60,000 people.',
      explanation: 'The industry claims it could employ 60,000 people by 2025 under the right conditions.',
    },
    {
      type: 'short_answer',
      question: 'What kind of timber product is available in large amounts from renewable forests in New Zealand?',
      answer: 'softwood',
      passage_excerpt: 'One competitive advantage that New Zealand has is its ability to source large quantities of softwood from renewable forests.',
      explanation: 'New Zealand’s competitive advantage is the ability to source large quantities of softwood from renewable forests.',
    },
    {
      type: 'short_answer',
      question: 'Which aspect of timber production are New Zealand\'s main customers increasingly concerned about?',
      answer: 'sustainability',
      passage_excerpt: 'Consumers in several key wood markets are becoming more worried about sustainability…',
      explanation: 'Key wood markets’ consumers are becoming more worried about sustainability.',
    },
    {
      type: 'short_answer',
      question: 'Outside the southern hemisphere, who are New Zealand forestry\'s main competitors?',
      answer: 'Scandinavian countries',
      passage_excerpt: '…and in the northern hemisphere, Scandinavian countries have all expanded their forests or controlled their use in the interests of future production.',
      explanation: 'In the northern hemisphere, Scandinavian countries are identified as competitors that have expanded or managed their forests for future production.',
    },
    {
      type: 'short_answer',
      question: 'Which group of products is New Zealand\'s forestry industry now having to compete with?',
      answer: 'wood substitutes',
      passage_excerpt: '…New Zealand faces competition from goods such as wood substitutes. These include steel framing for houses.',
      explanation: 'In addition to other wood producers, New Zealand faces competition from wood substitutes such as steel framing.',
    },
  ],
}

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
