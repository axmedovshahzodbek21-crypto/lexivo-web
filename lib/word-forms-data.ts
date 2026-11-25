// Word Forms (So'z shakllari) — pick the right form of a word in an IELTS-style
// sentence. Source: "VERB NOUN PHRASE.pdf", cleaned up: duplicates removed,
// identical pairs (influence→influence, support, increase, decline, risk)
// dropped because the hint would give the answer away, and the Adjective →
// Adverb section trimmed to pairs with a real, standard -ly adverb.
//
// `sentence` marks the answer in braces: "The {decision} to …". The text in
// braces is exactly what goes in the gap (so plurals like {restrictions}
// work). `wrong` are real words from the same family that do NOT fit the gap
// grammatically — never list a form that would also be acceptable there.
//
// Flutter copy is GENERATED: node scripts/word-forms-to-dart.js

export type WordFormSection = 'verb-noun' | 'adj-noun' | 'adj-adv';

export interface WordFormItem {
  id: string;
  section: WordFormSection;
  base: string;          // shown as the hint: (decide)
  target: string;        // dictionary form of the answer: decision
  uz: string;
  baseSentence: string;  // example using the base form, shown after answering
  sentence: string;      // gap sentence, answer in {braces}
  wrong: string[];
}

export const WORD_FORM_SECTIONS: WordFormSection[] = ['verb-noun', 'adj-noun', 'adj-adv'];

type Row = [base: string, target: string, uz: string, baseSentence: string, sentence: string, wrong: string[]];

const PREFIX: Record<WordFormSection, string> = { 'verb-noun': 'vn', 'adj-noun': 'an', 'adj-adv': 'aa' };

function build(section: WordFormSection, rows: Row[]): WordFormItem[] {
  return rows.map(([base, target, uz, baseSentence, sentence, wrong]) => ({
    id: `${PREFIX[section]}-${base}`, section, base, target, uz, baseSentence, sentence, wrong,
  }));
}

const VERB_NOUN: Row[] = [
  ['prefer', 'preference', 'afzallik', 'Many people prefer working remotely.', 'There is a growing {preference} for remote work due to its flexibility.', ['prefer', 'preferable', 'preferred']],
  ['decide', 'decision', 'qaror', 'Governments must decide whether to fund public or private education.', 'The {decision} to invest in public education has long-term benefits.', ['decide', 'decisive', 'decided']],
  ['grow', 'growth', "o'sish", 'The economy has grown rapidly in recent years.', 'Rapid economic {growth} has led to improved living standards.', ['grow', 'grown', 'growing']],
  ['improve', 'improvement', 'yaxshilanish', 'We must improve the public transport system.', 'Significant {improvement} in public transportation is urgently needed.', ['improve', 'improved', 'improving']],
  ['develop', 'development', 'rivojlanish', 'Technology has developed quickly in the past decade.', 'The {development} of advanced technologies has transformed communication.', ['develop', 'developed', 'developing']],
  ['participate', 'participation', 'ishtirok', 'More citizens should participate in community programs.', 'Public {participation} in local initiatives strengthens social cohesion.', ['participate', 'participated', 'participating']],
  ['invest', 'investment', 'sarmoya', 'Countries should invest more in green energy.', 'Government {investment} in renewable energy is essential for sustainability.', ['invest', 'invested', 'investor']],
  ['reduce', 'reduction', 'kamaytirish', 'We must reduce plastic waste.', 'A dramatic {reduction} in plastic use can be achieved through policy reforms.', ['reduce', 'reduced', 'reducing']],
  ['believe', 'belief', 'ishonch / e\'tiqod', 'Some people believe that success depends on talent.', 'The {belief} that talent guarantees success is widely held but debatable.', ['believe', 'believed', 'believable']],
  ['achieve', 'achievement', 'yutuq', 'Students must work hard to achieve success.', 'Academic {achievement} requires consistent effort and motivation.', ['achieve', 'achieved', 'achievable']],
  ['educate', 'education', "ta'lim", 'Schools aim to educate children about environmental issues.', 'Environmental {education} is vital for raising awareness among young people.', ['educate', 'educated', 'educational']],
  ['consume', 'consumption', "iste'mol", 'People consume too much fast food nowadays.', 'Excessive {consumption} of junk food contributes to obesity.', ['consume', 'consumed', 'consumer']],
  ['depend', 'dependence', "qaramlik / bog'liqlik", 'Many elderly people depend on public healthcare.', 'Increased {dependence} on public services strains government budgets.', ['depend', 'dependent', 'depended']],
  ['solve', 'solution', 'yechim', 'We must solve the traffic congestion issue.', 'One possible {solution} to urban congestion is investing in public transport.', ['solve', 'solved', 'solving']],
  ['prevent', 'prevention', 'oldini olish', 'Vaccines prevent the spread of diseases.', 'Early {prevention} is more effective than long-term treatment.', ['prevent', 'prevented', 'preventive']],
  ['produce', 'production', 'ishlab chiqarish', 'Factories produce large amounts of waste.', 'Industrial {production} often leads to environmental damage.', ['produce', 'produced', 'productive']],
  ['compare', 'comparison', 'solishtirish', 'People often compare city and rural life.', 'A {comparison} between urban and rural lifestyles reveals major differences in quality of life.', ['compare', 'compared', 'comparative']],
  ['oppose', 'opposition', 'qarshilik', 'Many citizens oppose the new law.', 'Public {opposition} forced the government to reconsider the policy.', ['oppose', 'opposed', 'opposing']],
  ['agree', 'agreement', 'kelishuv / rozilik', 'Most citizens agree with the new policy.', 'There is widespread {agreement} on the need for stricter traffic laws.', ['agree', 'agreed', 'agreeable']],
  ['disagree', 'disagreement', 'kelishmovchilik', 'Experts often disagree about the best treatment.', 'Ongoing {disagreement} among experts has delayed decision-making.', ['disagree', 'disagreed', 'disagreeable']],
  ['argue', 'argument', 'bahs / dalil', 'Some people argue that exams are outdated.', 'The {argument} that exams no longer reflect ability is gaining popularity.', ['argue', 'argued', 'arguable']],
  ['choose', 'choice', 'tanlov', 'Students can choose between several subjects.', 'The {choice} of subjects plays a crucial role in career planning.', ['choose', 'chose', 'chosen']],
  ['permit', 'permission', 'ruxsat', 'The school does not permit mobile phones in class.', '{permission} to use mobile devices is rarely granted in classrooms.', ['permitted', 'permitting', 'permissive']],
  ['restrict', 'restriction', 'cheklov', 'Some countries restrict access to social media.', 'The government imposed strict {restrictions} on internet use.', ['restricts', 'restricted', 'restrictive']],
  ['relate', 'relationship', "munosabat / bog'liqlik", 'Poverty often relates to poor education.', 'There is a strong {relationship} between poverty and lack of education.', ['relate', 'related', 'relating']],
  ['employ', 'employment', 'ish bilan bandlik', 'Companies employ thousands of workers annually.', 'The policy boosted {employment} in the manufacturing sector.', ['employ', 'employed', 'employable']],
  ['advertise', 'advertising', 'reklama', 'Brands advertise their products on social media.', 'Online {advertising} has become the most effective marketing strategy.', ['advertise', 'advertised', 'advertiser']],
  ['migrate', 'migration', 'migratsiya', 'People often migrate to cities in search of better jobs.', 'Urban areas are experiencing a rapid rise in {migration} due to economic opportunities.', ['migrate', 'migrated', 'migratory']],
  ['pollute', 'pollution', 'ifloslanish', 'Factories continue to pollute rivers and air.', 'Industrial {pollution} is one of the biggest threats to public health.', ['pollute', 'polluted', 'polluting']],
  ['innovate', 'innovation', 'innovatsiya', 'Tech companies must innovate to remain competitive.', 'Constant {innovation} drives progress in the digital economy.', ['innovate', 'innovated', 'innovative']],
  ['motivate', 'motivation', "rag'bat / motivatsiya", 'Teachers try to motivate students to study harder.', 'Student {motivation} is essential for academic success.', ['motivate', 'motivated', 'motivating']],
  ['regulate', 'regulation', 'tartibga solish', 'The government must regulate the use of harmful chemicals.', 'Strict {regulation} of toxic substances is necessary to protect the environment.', ['regulate', 'regulated', 'regulatory']],
  ['contribute', 'contribution', 'hissa', 'Citizens can contribute to their communities in many ways.', 'Volunteering is a valuable {contribution} to social development.', ['contribute', 'contributed', 'contributing']],
  ['protect', 'protection', 'himoya', 'Laws are needed to protect endangered species.', 'Wildlife {protection} must be prioritized to prevent extinction.', ['protect', 'protected', 'protective']],
  ['connect', 'connection', "aloqa / bog'lanish", 'Social media helps people connect globally.', 'The internet has strengthened global {connections} in business and education.', ['connects', 'connected', 'connecting']],
  ['compete', 'competition', 'raqobat', 'Companies compete to attract more customers.', 'Intense market {competition} leads to lower prices and better quality.', ['compete', 'competing', 'competitive']],
  ['require', 'requirement', 'talab', 'Most universities require English proficiency.', 'Language fluency is a basic {requirement} for admission to foreign universities.', ['require', 'required', 'requiring']],
  ['inspire', 'inspiration', 'ilhom', 'Great leaders inspire others to take action.', 'Mandela remains a powerful {inspiration} for social justice movements.', ['inspire', 'inspired', 'inspiring']],
  ['criticize', 'criticism', 'tanqid', "Many people criticize the government's handling of the crisis.", 'The policy faced strong public {criticism} for being ineffective.', ['criticize', 'criticized', 'critical']],
  ['recommend', 'recommendation', 'tavsiya', 'Experts often recommend reducing screen time for children.', "A common {recommendation} is to limit children's device use to two hours per day.", ['recommend', 'recommended', 'recommending']],
  ['vary', 'variety', 'xilma-xillik', 'Cultural norms vary from country to country.', 'A greater {variety} of learning methods can improve student engagement.', ['vary', 'various', 'varied']],
  ['limit', 'limitation', 'cheklov / kamchilik', 'We should limit the number of private vehicles in cities.', 'One major {limitation} of car ownership is traffic congestion.', ['limited', 'limiting', 'limitless']],
  ['expand', 'expansion', 'kengayish', 'Many businesses aim to expand into foreign markets.', 'The {expansion} of global trade has boosted economic growth.', ['expand', 'expanded', 'expansive']],
  ['enforce', 'enforcement', 'ijro etish', 'Authorities must enforce traffic laws strictly.', 'Strict law {enforcement} can reduce road accidents significantly.', ['enforce', 'enforced', 'enforcing']],
];

const ADJ_NOUN: Row[] = [
  ['important', 'importance', 'ahamiyat', 'Education is important for social development.', 'The {importance} of education in society cannot be overstated.', ['important', 'importantly', 'unimportant']],
  ['difficult', 'difficulty', 'qiyinchilik', 'It is difficult to find affordable housing in big cities.', 'Many people face {difficulty} in securing affordable housing.', ['difficult', 'different']],
  ['responsible', 'responsibility', "mas'uliyat", "Parents are responsible for their children's behavior.", 'The {responsibility} of raising children lies mainly with parents.', ['responsible', 'responsibly', 'irresponsible']],
  ['popular', 'popularity', 'mashhurlik', 'Online learning is becoming more popular.', 'The growing {popularity} of online learning is transforming education.', ['popular', 'popularly', 'popularize']],
  ['efficient', 'efficiency', 'samaradorlik / unumdorlik', 'Solar panels are more efficient than coal plants.', 'The {efficiency} of solar energy makes it a sustainable choice.', ['efficient', 'efficiently', 'inefficient']],
  ['different', 'difference', 'farq', 'Rural and urban lifestyles are different.', 'The {difference} between rural and urban life is significant.', ['different', 'differently', 'differ']],
  ['effective', 'effectiveness', 'samaradorlik / natijadorlik', 'Group work is often effective in classrooms.', 'The {effectiveness} of group work depends on student cooperation.', ['effective', 'effectively', 'ineffective']],
  ['possible', 'possibility', 'imkoniyat', 'It is possible to work and study at the same time.', 'The {possibility} of combining work and study offers flexibility to students.', ['possible', 'possibly', 'impossible']],
  ['likely', 'likelihood', 'ehtimollik', 'Children are likely to imitate adults.', 'The {likelihood} of children copying adult behavior is high.', ['likely', 'unlikely']],
  ['aware', 'awareness', 'xabardorlik', 'People are becoming more aware of climate change.', 'Public {awareness} of climate issues is increasing worldwide.', ['aware', 'unaware']],
  ['equal', 'equality', 'tenglik', 'Men and women should have equal opportunities.', 'Gender {equality} is essential for a fair society.', ['equal', 'equally', 'equalize']],
  ['safe', 'safety', 'xavfsizlik', 'Wearing a seatbelt keeps passengers safe.', 'Road {safety} regulations save lives.', ['safe', 'safely', 'unsafe']],
  ['active', 'activity', 'faollik / faoliyat', 'Children should stay active to be healthy.', "Physical {activity} is vital for a child's development.", ['active', 'actively', 'activate']],
  ['creative', 'creativity', 'ijodkorlik', 'A creative approach helps solve problems.', "{creativity} is a key skill in today's job market.", ['creative', 'creatively', 'create']],
  ['reliable', 'reliability', 'ishonchlilik', 'Public transport must be reliable.', 'The {reliability} of public transportation influences commuter choices.', ['reliable', 'reliably', 'rely']],
  ['realistic', 'realism', 'realizm / haqiqatparastlik', 'A realistic approach is required in policy-making.', '{realism} in policymaking ensures practical and achievable outcomes.', ['realistic', 'realistically', 'real']],
  ['necessary', 'necessity', 'zarurat', 'Internet access is necessary for modern education.', 'The {necessity} of internet access in schools is undeniable.', ['necessary', 'necessarily', 'unnecessary']],
  ['relevant', 'relevance', 'dolzarblik', 'Some school subjects are no longer relevant to the job market.', 'The {relevance} of school curricula to real-world jobs is under debate.', ['relevant', 'relevantly', 'irrelevant']],
  ['attractive', 'attractiveness', 'jozibadorlik', 'Cities invest in making parks more attractive.', 'The {attractiveness} of urban green spaces boosts community well-being.', ['attractive', 'attractively', 'attract']],
  ['productive', 'productivity', 'mahsuldorlik', 'A productive workforce boosts the economy.', '{productivity} is essential for economic growth.', ['productive', 'productively', 'produce']],
  ['honest', 'honesty', 'halollik', 'Employers value honest workers.', '{honesty} in the workplace builds trust and cooperation.', ['honest', 'honestly', 'dishonest']],
  ['intelligent', 'intelligence', 'intellekt / aql', 'Intelligent students learn concepts quickly.', 'Emotional {intelligence} is as important as academic skills.', ['intelligent', 'intelligently', 'intellectual']],
  ['confident', 'confidence', "o'ziga ishonch", 'She was confident in her ability to succeed.', '{confidence} helps students perform better in exams.', ['confident', 'confidently', 'confide']],
  ['curious', 'curiosity', 'qiziquvchanlik', 'Children are naturally curious about the world.', '{curiosity} is the foundation of scientific discovery.', ['curious', 'curiously']],
  ['friendly', 'friendliness', "do'stona munosabat", 'The staff were very friendly and helpful.', '{friendliness} creates a welcoming atmosphere in public places.', ['friendly', 'unfriendly']],
  ['healthy', 'health', "sog'liq", 'A healthy diet reduces disease risk.', 'Good {health} depends on lifestyle choices.', ['healthy', 'healthily', 'unhealthy']],
  ['weak', 'weakness', 'zaiflik / kamchilik', 'The proposal is weak and lacks support.', 'A major {weakness} of the proposal is its cost.', ['weak', 'weakly', 'weaken']],
  ['strong', 'strength', 'kuch / kuchli tomon', 'She gave a strong argument in the debate.', 'Her main {strength} is critical thinking.', ['strong', 'strongly', 'strengthen']],
  ['kind', 'kindness', 'mehribonlik', 'Being kind to others builds positive relationships.', 'Acts of {kindness} strengthen communities.', ['kind', 'kindly', 'unkind']],
  ['rude', 'rudeness', "qo'pollik", 'His behavior was extremely rude.', 'Public {rudeness} is often a result of stress or frustration.', ['rude', 'rudely']],
  ['selfish', 'selfishness', 'xudbinlik', 'Selfish actions harm group progress.', '{selfishness} in team settings creates conflict.', ['selfish', 'selfishly', 'unselfish']],
  ['polite', 'politeness', 'xushmuomalalik', 'Children should be taught to be polite.', '{politeness} is a basic value in social interaction.', ['polite', 'politely', 'impolite']],
  ['lonely', 'loneliness', "yolg'izlik", 'The elderly often feel lonely.', '{loneliness} can negatively affect mental health.', ['lonely', 'alone']],
  ['happy', 'happiness', 'baxt', "Money doesn't always make people happy.", 'True {happiness} comes from meaningful relationships.', ['happy', 'happily', 'unhappy']],
  ['sad', 'sadness', "qayg'u", 'He felt sad after losing his job.', '{sadness} is a natural response to failure.', ['sad', 'sadly', 'sadden']],
  ['free', 'freedom', 'erkinlik', 'Every citizen should be free to speak their mind.', '{freedom} of speech is a core democratic value.', ['free', 'freely', 'freed']],
  ['bored', 'boredom', 'zerikish', 'Students feel bored during long lectures.', '{boredom} in class can reduce attention and performance.', ['bored', 'boring', 'boringly']],
  ['proud', 'pride', 'faxr / g\'urur', 'She was proud of her academic success.', 'Academic {pride} motivates students to do better.', ['proud', 'proudly']],
  ['angry', 'anger', "g'azab", 'Many drivers become angry in traffic.', '{anger} often leads to road rage.', ['angry', 'angrily', 'angered']],
  ['poor', 'poverty', 'qashshoqlik', 'Poor communities lack access to healthcare.', '{poverty} remains one of the biggest global challenges.', ['poor', 'poorly']],
  ['rich', 'wealth', 'boylik', 'Only the rich can afford luxury education.', '{wealth} is often unequally distributed in society.', ['rich', 'richly', 'wealthy']],
  ['young', 'youth', 'yoshlar / yoshlik', 'Young people are more open to change.', '{youth} should be empowered to shape the future.', ['young', 'youthful', 'youthfully']],
  ['old', 'age', 'yosh / qarilik', 'Old workers may struggle with new technology.', 'With {age} comes both wisdom and physical decline.', ['old', 'older', 'aged']],
  ['violent', 'violence', "zo'ravonlik", 'Many video games are violent.', 'Exposure to media {violence} may affect behavior.', ['violent', 'violently']],
  ['critical', 'criticism', 'tanqid', "She was critical of the government's actions.", 'Public {criticism} led to political reform.', ['critical', 'critically', 'criticize']],
  ['generous', 'generosity', 'saxiylik', 'He is known for being generous.', 'Acts of {generosity} can change lives.', ['generous', 'generously', 'ungenerous']],
  ['lazy', 'laziness', 'dangasalik', 'Lazy students rarely succeed.', '{laziness} is a barrier to academic progress.', ['lazy', 'lazily']],
  ['tired', 'tiredness', 'charchoq', 'She felt tired after studying all night.', '{tiredness} reduces concentration and memory.', ['tired', 'tiring', 'tire']],
];

const ADJ_ADV: Row[] = [
  ['important', 'importantly', 'eng muhimi', 'Education is important for social progress.', '{importantly}, education reduces poverty.', ['important', 'importance', 'unimportant']],
  ['responsible', 'responsibly', "mas'uliyat bilan", "Parents are responsible for their children's behavior.", 'They must act {responsibly} online.', ['responsible', 'responsibility', 'irresponsible']],
  ['popular', 'popularly', 'ommaviy tarzda', 'TikTok is popular among teenagers.', 'That show is {popularly} known as a classic.', ['popular', 'popularity', 'popularize']],
  ['efficient', 'efficiently', 'samarali', 'Solar energy is more efficient than coal.', 'The engine runs {efficiently} even in cold weather.', ['efficient', 'efficiency', 'inefficient']],
  ['different', 'differently', 'boshqacha', 'Boys and girls may have different learning styles.', 'They responded {differently} to the same challenge.', ['different', 'difference', 'differ']],
  ['effective', 'effectively', 'samarali', "It's an effective solution to air pollution.", 'The system works {effectively} even under pressure.', ['effective', 'effectiveness', 'effect']],
  ['possible', 'possibly', 'ehtimol', "It's not possible to finish in one day.", 'He will {possibly} arrive tomorrow.', ['possible', 'possibility', 'impossible']],
  ['equal', 'equally', 'teng', 'All citizens must have equal rights.', 'The money was {equally} divided.', ['equal', 'equality', 'equalize']],
  ['safe', 'safely', 'xavfsiz', 'The city is no longer safe at night.', 'The pilot landed the plane {safely}.', ['safe', 'safety', 'unsafe']],
  ['active', 'actively', 'faol', 'She lives an active lifestyle.', 'Students {actively} participated in the debate.', ['active', 'activity', 'activate']],
  ['creative', 'creatively', 'ijodiy', 'A creative mind can solve tough problems.', 'They solved the issue {creatively}.', ['creative', 'creativity', 'create']],
  ['reliable', 'reliably', 'ishonchli', "He's a reliable employee.", 'The train {reliably} arrives on time.', ['reliable', 'reliability', 'rely']],
  ['realistic', 'realistically', 'real tarzda', 'Be realistic about your goals.', "You can't {realistically} expect perfection.", ['realistic', 'realism', 'real']],
  ['necessary', 'necessarily', 'albatta / shart', 'Strong laws are necessary for safety.', "Strict laws aren't {necessarily} the best.", ['necessary', 'necessity', 'unnecessary']],
  ['attractive', 'attractively', 'jozibali', 'She has an attractive personality.', 'The products are {attractively} packaged.', ['attractive', 'attraction', 'attract']],
  ['productive', 'productively', 'unumli', 'He had a productive morning.', 'She worked {productively} for hours.', ['productive', 'productivity', 'produce']],
  ['honest', 'honestly', 'rostini aytsam / halol', "He's an honest person.", "{honestly}, I didn't expect that result.", ['honest', 'honesty', 'dishonest']],
  ['intelligent', 'intelligently', 'aqlli tarzda', 'She is very intelligent.', 'He handled the situation {intelligently}.', ['intelligent', 'intelligence', 'intellect']],
  ['confident', 'confidently', 'ishonch bilan', 'She was confident during the interview.', 'He spoke {confidently} in public.', ['confident', 'confidence', 'confide']],
  ['curious', 'curiously', 'qiziqib', 'Children are naturally curious.', 'She looked at the painting {curiously}.', ['curious', 'curiosity']],
  ['weak', 'weakly', 'zaif', 'His voice was weak after the illness.', 'He {weakly} protested the decision.', ['weak', 'weakness', 'weaken']],
  ['strong', 'strongly', "qat'iy / kuchli", 'She has a strong personality.', 'I {strongly} disagree with that opinion.', ['strong', 'strength', 'strengthen']],
  ['kind', 'kindly', 'mehribonlik bilan', 'He is a kind man.', 'She {kindly} offered her help.', ['kind', 'kindness', 'unkind']],
  ['rude', 'rudely', "qo'pollik bilan", 'That was a rude comment.', 'He {rudely} interrupted the meeting.', ['rude', 'rudeness']],
  ['selfish', 'selfishly', 'xudbinlarcha', 'That was a selfish decision.', 'He {selfishly} ignored the team.', ['selfish', 'selfishness', 'unselfish']],
  ['polite', 'politely', 'xushmuomalalik bilan', 'She is very polite.', 'He spoke {politely} to the teacher.', ['polite', 'politeness', 'impolite']],
  ['happy', 'happily', 'baxtli', 'They look very happy.', 'They lived {happily} ever after.', ['happy', 'happiness', 'unhappy']],
  ['sad', 'sadly', 'afsuski', 'She felt sad after the call.', "{sadly}, he didn't make it.", ['sad', 'sadness', 'sadden']],
  ['free', 'freely', 'erkin', 'You are free to ask questions.', 'Students speak {freely} in this class.', ['free', 'freedom', 'freed']],
  ['proud', 'proudly', 'faxr bilan', 'Her parents were proud of her.', 'She {proudly} accepted the award.', ['proud', 'pride']],
  ['angry', 'angrily', 'jahl bilan', 'He was angry about the delay.', 'She shouted {angrily} at the waiter.', ['angry', 'anger', 'angered']],
  ['poor', 'poorly', 'yomon / sust', 'Many students come from poor backgrounds.', 'He performed {poorly} in the exam due to stress.', ['poor', 'poverty']],
  ['rich', 'richly', 'boy / batafsil', 'He became rich through hard work.', 'The novel is {richly} detailed and vivid.', ['rich', 'wealth', 'riches']],
  ['violent', 'violently', 'qattiq / shiddat bilan', 'He had a violent temper.', 'The car shook {violently} on the rough road.', ['violent', 'violence', 'violate']],
  ['critical', 'critically', "og'ir / tanqidiy", 'She played a critical role in the project.', 'He was {critically} injured in the crash.', ['critical', 'criticism', 'criticize']],
  ['generous', 'generously', 'saxiylik bilan', 'He is known as a generous donor.', 'She {generously} gave her time to charity.', ['generous', 'generosity']],
  ['lazy', 'lazily', 'erinchoqlik bilan', 'He is too lazy to study.', 'The cat stretched {lazily} in the sun.', ['lazy', 'laziness']],
];

export const WORD_FORMS: WordFormItem[] = [
  ...build('verb-noun', VERB_NOUN),
  ...build('adj-noun', ADJ_NOUN),
  ...build('adj-adv', ADJ_ADV),
];

export function wordFormsIn(section: WordFormSection): WordFormItem[] {
  return WORD_FORMS.filter(w => w.section === section);
}
