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
  paragraphLabels?: string;   // e.g. "A–G" for matching_information / matching_headings
  featureListTitle?: string;  // e.g. "List of People" for matching_features
  summaryText?: string;       // full summary paragraph with [N] placeholders for summary_completion
  summaryTitle?: string;      // e.g. "Uses of a Popular Tree" — title of the summary box
  summaryOptions?: string[];  // for letter-based summary completion (A–H phrases)
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

Finally, in addition to competition from other wood producers, New Zealand faces competition from goods such as wood substitutes. These include steel framing for houses. This further underlines the necessity for globally competitive production and marketing strategies.pulp*: wood which is crushed until soft enough to form the basis of paper.`,
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
},

      // ── Test 2 ─────────────────────────────────────────────────────────────
{
  testNumber: 2,
  title: 'The Early History of Olive Oil',
  questionRange: '1–12',
  content: `Olive oil is produced from the fruit of the olive tree, which is a member of the Oleaceae plant family. The trees require some cold weather during the year, but also tolerate hot, dry conditions, and do not like moisture when they are flowering. They actually produce better when subjected to these stressful conditions, and as a result, olive trees have traditionally been grown on land where little else will survive.

Archaeologists today are divided over exactly where the first domestication of the olive occurred: Some say it was in the area which is now Iran, Syria, Jordan and Egypt, while others contend it was in mainland Greece or on the island of Crete. The one thing that can be said with certainty is that cultivation began at least 6,000 years ago and spread slowly westward across the lands bordering on the Mediterranean Sea. Olive oil was used for a variety of purposes during these early times, including as a pharmacological ointment and in rituals for anointing royalty.

The ancient Greeks believed the olive tree was a priceless gift from the goddess Athena and used its oil in sacred religious rituals. In fact, the Greek poet Homer called olive oil 'liquid gold', and during the 6th and 7th centuries BC Greek law forbade the cutting down of olive trees and made it punishable by death. The ancient Middle Eastern ruler King David valued his groves of olive trees and his olive oil warehouses so much that he posted guards around the clock to protect them.

Over the years, olive oil developed other uses. Its employment in cooking dates at least as far back as the 5th century BC, as described by the Greek philosopher Plato. Its use as an aid to beauty and health later became ingrained in many Mediterranean cultures. The Romans, for example, are said to have used generous amounts on their bodies to moisturise their skin after bathing. With the spread of the Roman Empire, olive oil became a major commodity and its trade promoted commerce throughout the ancient world. It is generally believed that in the 1st-2nd century BC, olive trees were taken to North Africa and then to Spain, which was later to become the world's largest producer of olive oil.

Artefacts found at various Mediterranean archaeological sites include olive oil storage vessels with olive plant residue still in them. Historical evidence still in existence in the form of wall paintings and ancient manuscripts (including the works of the Roman naturalist and philosopher, Pliny the Elder) all record production techniques and the various uses of olive oil.

Making olive oil in those early days was a laborious process accomplished without mechanisation. Processing or milling the fruit involved several distinct steps to extract the liquid. The olives were harvested from the trees by hand or by beating the fruit from the trees with long sticks. The olives were then rinsed and crushed to separate out the large seed found in the centre of each. The remaining seedless flesh was put in woven bags and pressed. Hot water was then poured over the bags to separate the oil from the solid bits of olive. The liquid produced in this process, consisting of oil and water, was drained into stone basins or tanks, where it was allowed to settle and separate. In cold weather a bit of salt was added to speed up the process. As much oil as possible was drawn off the water, but the result was still not pure oil. Therefore, this impure mixture was allowed once more to settle in vats and then separated in order to refine the product.

The waste water from the milling process, which is called amurca, is a bitter-tasting and foul-smelling liquid. In many ancient civilisations it was often simply discarded, causing serious pollution because of its acidity and high salt content. However, in the Roman period it was regarded as a very useful substance. When spread on surfaces, amurca forms a hard finish and therefore it was often applied to the floors of grain storage buildings where it hardened, keeping out water, mud and pests. When boiled down amurca was applied to leather to soften it so that it was easier to shape into articles of clothing and shoes. It could also be eaten by farm animals and was, in fact, fed to livestock suffering from malnutrition. According to ancient texts, amurca was also utilised in moderate amounts by farmers as a fertiliser or as a pesticide helping them to protect their crops from insects and even small rodents.`,
  questions: [
    {
      type: 'true_false_not_given',
      question: 'In the cultivation of olives, a period without rain is advantageous.',
      answer: 'TRUE',
      passage_excerpt: 'They actually produce better when subjected to these stressful conditions… tolerate hot, dry conditions, and do not like moisture when they are flowering.',
      explanation: 'The passage states that olive trees produce better under stressful dry conditions and dislike moisture during flowering, so a period without rain is advantageous.',
    },
    {
      type: 'true_false_not_given',
      question: 'The most fertile fields are usually chosen for growing olives.',
      answer: 'FALSE',
      passage_excerpt: '…olive trees have traditionally been grown on land where little else will survive.',
      explanation: 'The text says olives are grown on poor land where little else will grow, not on the most fertile fields.',
    },
    {
      type: 'true_false_not_given',
      question: 'In ancient Greece, the olive tree was said to have divine origins.',
      answer: 'TRUE',
      passage_excerpt: 'The ancient Greeks believed the olive tree was a priceless gift from the goddess Athena…',
      explanation: 'The Greeks regarded the olive tree as a divine gift from the goddess Athena, so it was said to have divine origins.',
    },
    {
      type: 'true_false_not_given',
      question: 'Olive oil was more costly to buy in Greece than gold.',
      answer: 'NOT GIVEN',
      passage_excerpt: '…the Greek poet Homer called olive oil \'liquid gold\'…',
      explanation: 'Homer used the phrase "liquid gold" as a metaphor, but the passage does not say olive oil was more expensive than actual gold.',
    },
    {
      type: 'true_false_not_given',
      question: 'Plato mentions the use of olive oil in the preparation of food.',
      answer: 'TRUE',
      passage_excerpt: 'Its employment in cooking dates at least as far back as the 5th century BC, as described by the Greek philosopher Plato.',
      explanation: 'The passage explicitly states that Plato described the use of olive oil in cooking.',
    },
    {
      type: 'true_false_not_given',
      question: 'North African farmers initially resisted the introduction of olive trees.',
      answer: 'NOT GIVEN',
      passage_excerpt: 'It is generally believed that in the 1st-2nd century BC, olive trees were taken to North Africa…',
      explanation: 'The text only says olive trees were taken to North Africa; it gives no information about any resistance from local farmers.',
    },
    {
      type: 'sentence_completion',
      question: 'olives are harvested by picking them or ___ the trees',
      answer: 'beating',
      passage_excerpt: 'The olives were harvested from the trees by hand or by beating the fruit from the trees with long sticks.',
      explanation: 'Harvesting was done by hand or by beating the trees.',
    },
    {
      type: 'sentence_completion',
      question: 'Olive flesh is placed in ___ and pressed',
      answer: 'bags',
      passage_excerpt: 'The remaining seedless flesh was put in woven bags and pressed.',
      explanation: 'The olive flesh was placed in woven bags before pressing.',
    },
    {
      type: 'sentence_completion',
      question: 'Resulting liquid is given time to settle and separate, and ___ is used to aid the process',
      answer: 'salt',
      passage_excerpt: 'In cold weather a bit of salt was added to speed up the process.',
      explanation: 'Salt was added to help the liquid settle and separate more quickly in cold weather.',
    },
    {
      type: 'sentence_completion',
      question: 'when dried, created hard surface, so used on ___ of certain buildings',
      answer: 'floors',
      passage_excerpt: '…it was often applied to the floors of grain storage buildings where it hardened…',
      explanation: 'When dried, amurca formed a hard surface and was used on the floors of certain buildings.',
    },
    {
      type: 'sentence_completion',
      question: 'used when making ___ into goods to wear',
      answer: 'leather',
      passage_excerpt: 'When boiled down amurca was applied to leather to soften it so that it was easier to shape into articles of clothing and shoes.',
      explanation: 'Amurca was used on leather to soften it for making wearable goods.',
    },
    {
      type: 'sentence_completion',
      question: 'used on farms as a ___ to stop insects or animals damaging crops',
      answer: 'pesticide',
      passage_excerpt: '…amurca was also utilised… as a pesticide helping them to protect their crops from insects and even small rodents.',
      explanation: 'On farms it was used as a pesticide to stop insects and animals from damaging crops.',
    },
  ],
},

{
testNumber: 3,
title: "A survivor's story",
subtitle: "One native bird in New Zealand that has managed to survive the introduction of non-native species",
questionRange: "1–13",
content: "As an island country with a fauna dominated by birds, New Zealand was once home to an owl species which is now extinct, the laughing owl, named for its distinctive cry. This bird was widespread throughout the islands when European settlers arrived in the middle of the 19th century and it remained in good numbers for some years thereafter. Where other native birds suffered from predation by the Polynesian rat, the laughing owl turned the tables and adapted its diet to include the rodent. It was also capable of catching and killing the other New Zealand owl, the morepork, and even larger birds, such as the weka. However, the laughing owl was wiped out around the beginning of the 20th century. Its demise caused by specimen collectors, habitat changes, and non-native predators including cats and stoats. Surprisingly, it is the smaller owl, the morepork, that has managed to survive until this day.\n\nSpeckled dark brown, with yellow eyes and long tails, they are around 29 centimeters long from head to tail and 175 grams in weight. Moreporks have fringes on the edge of their feathers, so they can fly almost silently and not alert potential prey. They have acute hearing and their large eyes are very sensitive to light.\n\nMoreporks nest in tree hollows, in clumps of plants, or in cavities among rocks and roots. In the wild, moreporks usually start nesting in October, although zoo specimens have been recorded nesting in midwinter, possibly stimulated by an ample food supply. The female lays up to three white eggs, which she incubates for 20 to 30 days. During this time, she rarely hunts, and the male brings food to her. Once the chicks hatch, she stays mainly on the nest until the young owls are fully feathered. When hatched, chicks are covered in light grey down, and have their eyes closed. The eyes do not open until the eighth day after hatching. They can fly at around 35 days.\n\nBy day, moreporks sleep in roosts. By night, they hunt a variety of animals -- mainly large invertebrates including scarab and huhu beetles, moths, caterpillars and spiders. They also take small birds and mice. They can find suitable food in pine forests as well as native forest. A morepork uses its sharp talons to catch or stun its prey, which it then carries away in its bill. Moreporks are clever hunters, and birds such as robins, grey warblers and fantails can end up as their prey. In the day, these small birds sometimes mob drowsy moreporks and chase them away from their roosts. They force the sleepy predators to search for a more peaceful spot.\n\nMoreporks have proved to be ungracious hosts. Scientists trying to establish a population of plovers on Motuora island in New Zealand's Hauraki Gulf were mystified as to why only two birds survived out of 75 placed there. The culprits turned out to be five pairs of moreporks that ate or chased away the new arrivals.\n\nAlthough moreporks are still considered to be relatively common, it is likely that numbers are in gradual decline due to predation and loss of habitat. As the female is a hole-nester, she is vulnerable to predators such as stoats and possums during the breeding season, and eggs and chicks will also be at risk from rats. The use of pesticides is another possible threat to the owls though not a direct one. As moreporks are at the top of the food chain, they could be affected by an accumulative poison by consuming prey that has ingested poison.\n\nThe New Zealand Department of Conservation is taking steps to ensure the preservation of New Zealand's only native owl. The department is involved in measuring the population of moreporks and has put transmitters on a number of birds to determine survival and mortality. As well as being New Zealand's only native owl, the morepork has symbolic and spiritual importance, so in monitoring the birds it is hoped that the morepork will continue to survive and thrive.\n\nAt dusk, the melancholy sound of the morepork can be heard in forests and parks as it calls to other moreporks and claims territory. Its Maori name (ruru) echoes its two-part cry. In the tradition of the Maori people of New Zealand, the morepork, or ruru, was often seen as a careful guardian. A number of sayings referred to the bird's alertness. As a bird of the night, it was associated with the spirit world. Moreporks were believed to act as messengers to the gods in the heavens, flying along spiritual paths in the sky. They were the mediums used to communicate with the gods. The occasional high, piercing call of the morepork signified bad news, but the lower-pitched and more common \"ruru\" call heralded good news.",
questions: [
{
type: "true_false_not_given",
question: "Early European settlers made detailed studies of the morepork.",
answer: "NOT GIVEN",
passage_excerpt: "This bird was widespread throughout the islands when European settlers arrived in the middle of the 19th century…",
explanation: "The passage mentions European settlers in relation to the laughing owl but gives no information about any detailed studies of the morepork by early settlers."
},
{
type: "true_false_not_given",
question: "The Polynesian rat had a negative effect on the number of laughing owls.",
answer: "FALSE",
passage_excerpt: "Where other native birds suffered from predation by the Polynesian rat, the laughing owl turned the tables and adapted its diet to include the rodent.",
explanation: "The laughing owl benefited by eating the Polynesian rat rather than being negatively affected by it."
},
{
type: "true_false_not_given",
question: "The laughing owl was larger than the morepork.",
answer: "TRUE",
passage_excerpt: "It was also capable of catching and killing the other New Zealand owl, the morepork… Surprisingly, it is the smaller owl, the morepork, that has managed to survive until this day.",
explanation: "The passage explicitly describes the morepork as the smaller owl and notes that the laughing owl could catch and kill it."
},
{
type: "true_false_not_given",
question: "Rats pose a risk to young moreporks.",
answer: "TRUE",
passage_excerpt: "…eggs and chicks will also be at risk from rats.",
explanation: "The text states that rats pose a risk to eggs and chicks (young moreporks)."
},
{
type: "true_false_not_given",
question: "The New Zealand Department of Conservation is hoping to limit the population of moreporks.",
answer: "FALSE",
passage_excerpt: "The New Zealand Department of Conservation is taking steps to ensure the preservation of New Zealand’s only native owl… it is hoped that the morepork will continue to survive and thrive.",
explanation: "The Department is working to preserve and help the morepork survive, not to limit its population."
},
{
type: "true_false_not_given",
question: "Other bird species are frightened away when they hear the morepork's cry.",
answer: "NOT GIVEN",
passage_excerpt: "At dusk, the melancholy sound of the morepork can be heard… Its Maori name (ruru) echoes its two-part cry.",
explanation: "The passage describes the morepork’s cry and its cultural significance but does not say that other bird species are frightened away by it."
},
{
type: "true_false_not_given",
question: "In Maori tradition, the low call of the morepork had negative associations.",
answer: "FALSE",
passage_excerpt: "The occasional high, piercing call of the morepork signified bad news, but the lower-pitched and more common ‘ruru’ call heralded good news.",
explanation: "In Maori tradition the low call was associated with good news (positive), not negative associations."
},
{
type: "sentence_completion",
question: "approximately ___ in length",
answer: "29 centimetres",
passage_excerpt: "…they are around 29 centimeters long from head to tail…",
explanation: "The passage states the morepork is approximately 29 centimetres in length."
},
{
type: "sentence_completion",
question: "nests in trees, plants or spaces in roots and ___",
answer: "rocks",
passage_excerpt: "Moreporks nest in tree hollows, in clumps of plants, or in cavities among rocks and roots.",
explanation: "Nests are found in trees, plants, or spaces among roots and rocks."
},
{
type: "sentence_completion",
question: "transports its prey using its ___",
answer: "bill",
passage_excerpt: "A morepork uses its sharp talons to catch or stun its prey, which it then carries away in its bill.",
explanation: "The morepork transports (carries away) its prey in its bill."
},
{
type: "sentence_completion",
question: "can be chased away by other birds during the ___",
answer: "day",
passage_excerpt: "In the day, these small birds sometimes mob drowsy moreporks and chase them away from their roosts.",
explanation: "Other birds chase moreporks away during the day."
},
{
type: "sentence_completion",
question: "attacked ___ that had been introduced to Motuora island",
answer: "plovers",
passage_excerpt: "Scientists trying to establish a population of plovers on Motuora island… The culprits turned out to be five pairs of moreporks that ate or chased away the new arrivals.",
explanation: "Moreporks attacked (ate or chased away) the plovers that had been introduced to Motuora island."
},
{
type: "sentence_completion",
question: "may be exposed to ___ in their prey",
answer: "poison",
passage_excerpt: "…they could be affected by an accumulative poison by consuming prey that has ingested poison.",
explanation: "Moreporks may be exposed to poison accumulated in their prey."
}
]
}

      // ── Test 4 ───────────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 4

      // ── Test 5 ───────────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 5

      // ── Test 6 ───────────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 6

      // ── Test 7 ───────────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 7

      // ── Test 8 ───────────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 8

      // ── Test 9 ───────────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 9

      // ── Test 10 ───────────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 10

      // ── Test 11 ───────────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 11

      // ── Test 12 ───────────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 12

      // ── Test 13 ───────────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 13

      // ── Test 14 ───────────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 14

      // ── Test 15 ───────────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 15

      // ── Test 16 ───────────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 16

      // ── Test 17 ───────────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 17

      // ── Test 18 ───────────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 18

      // ── Test 19 ───────────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 19

      // ── Test 20 ───────────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 20

      // ── Test 21 ───────────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 21

      // ── Test 22 ───────────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 22

      // ── Test 23 ───────────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 23

      // ── Test 24 ───────────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 24

      // ── Test 25 ───────────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 25

      // ── Test 26 ───────────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 26

      // ── Test 27 ───────────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 27

      // ── Test 28 ───────────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 28

      // ── Test 29 ───────────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 29

      // ── Test 30 ───────────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 30

    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PASSAGE 2 — all "second passages" from every test
  // ═══════════════════════════════════════════════════════════════════════════
  {
    passageSection: 2,
    tests: [

      // ── Test 1 ──────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 1

      // ── Test 2 ──────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 2

      // ── Test 3 ──────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 3

      // ── Test 4 ──────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 4

      // ── Test 5 ──────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 5

      // ── Test 6 ──────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 6

      // ── Test 7 ──────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 7

      // ── Test 8 ──────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 8

      // ── Test 9 ──────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 9

      // ── Test 10 ─────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 10

      // ── Test 11 ─────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 11

      // ── Test 12 ─────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 12

      // ── Test 13 ─────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 13

      // ── Test 14 ─────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 14

      // ── Test 15 ─────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 15

      // ── Test 16 ─────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 16

      // ── Test 17 ─────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 17

      // ── Test 18 ─────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 18

      // ── Test 19 ─────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 19

      // ── Test 20 ─────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 20

      // ── Test 21 ─────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 21

      // ── Test 22 ─────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 22

      // ── Test 23 ─────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 23

      // ── Test 24 ─────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 24

      // ── Test 25 ─────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 25

      // ── Test 26 ─────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 26

      // ── Test 27 ─────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 27

      // ── Test 28 ─────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 28

      // ── Test 29 ─────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 29

      // ── Test 30 ─────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 30

    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PASSAGE 3 — all "third passages" from every test
  // ═══════════════════════════════════════════════════════════════════════════
  {
    passageSection: 3,
    tests: [

      // ── Test 1 ──────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 1

      // ── Test 2 ──────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 2

      // ── Test 3 ──────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 3

      // ── Test 4 ──────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 4

      // ── Test 5 ──────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 5

      // ── Test 6 ──────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 6

      // ── Test 7 ──────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 7

      // ── Test 8 ──────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 8

      // ── Test 9 ──────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 9

      // ── Test 10 ─────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 10

      // ── Test 11 ─────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 11

      // ── Test 12 ─────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 12

      // ── Test 13 ─────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 13

      // ── Test 14 ─────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 14

      // ── Test 15 ─────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 15

      // ── Test 16 ─────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 16

      // ── Test 17 ─────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 17

      // ── Test 18 ─────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 18

      // ── Test 19 ─────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 19

      // ── Test 20 ─────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 20

      // ── Test 21 ─────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 21

      // ── Test 22 ─────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 22

      // ── Test 23 ─────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 23

      // ── Test 24 ─────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 24

      // ── Test 25 ─────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 25

      // ── Test 26 ─────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 26

      // ── Test 27 ─────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 27

      // ── Test 28 ─────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 28

      // ── Test 29 ─────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 29

      // ── Test 30 ─────────────────────────────────────────────────────────────
      // Paste output of AI tool for Test 30

    ],
  },

];
