export interface ReadingQuestion {
  question: string;
  explanation: string;
}

export interface ReadingPassage {
  id: number;
  title: string;
  topic: string;
  content: string;
  questions: ReadingQuestion[];
}

export const readingPassages: ReadingPassage[] = [

  {
    id: 1,
    title: 'Childhood',
    topic: 'Society & Development',
    content: `Childhood is the early stage of human life that spans from birth to adolescence. It is a critical period of physical, emotional, cognitive, and social development that lays the foundation for an individual's future well-being and success. Although every child's experience is unique, childhood is universally recognized as a time of learning, growth, and discovery.

From a biological perspective, childhood is marked by rapid growth and development. Infants learn to crawl, walk, and speak, while toddlers begin to explore the world around them through play and interaction. By the time children reach school age, they acquire basic academic skills, emotional regulation, and social behaviors. The quality of care and stimulation received during these years significantly influences brain development and later outcomes in health, education, and relationships.

The concept of childhood has evolved over time and varies across cultures. In traditional societies, children were often viewed as small adults expected to contribute to household or agricultural work from an early age. In contrast, modern industrialized societies tend to regard childhood as a protected period during which children are nurtured and educated, free from the burdens of adult responsibilities.

Family environment plays a key role in shaping childhood. Parents and caregivers provide not only physical care but also emotional support, discipline, and moral guidance. Warm, responsive parenting fosters secure attachment, confidence, and resilience, while neglect or abuse can lead to long-term emotional and psychological issues. Sibling relationships, extended family, and community networks also influence a child's development.

Education is another major influence during childhood. Early childhood education programs help children develop language, motor, and social skills. Formal schooling introduces them to structured learning, discipline, and peer relationships. Access to quality education during childhood is one of the most reliable predictors of future success, including higher earnings, better health, and civic participation.

Play is considered a vital part of childhood. Through play, children develop creativity, problem-solving abilities, and social skills. It allows them to express emotions, practice roles, and learn cooperation. Both structured play, such as games and sports, and unstructured play, such as imaginative storytelling, contribute to a child's cognitive and emotional growth. Unfortunately, in some regions, the pressure of academic achievement has reduced opportunities for free play.

Childhood is also a time when values, beliefs, and identity begin to form. Children learn by observing adults and absorbing cultural norms. Stories, rituals, and traditions help shape a child's sense of belonging and morality. As they grow older, children begin to question authority, develop independence, and form their own opinions about the world.

However, not all children experience a happy or healthy childhood. Millions face challenges such as poverty, malnutrition, violence, and lack of access to education. According to UNICEF, more than 1 in 5 children worldwide live in extreme poverty, and many are forced into child labor or early marriage. These experiences rob children of the chance to learn, grow, and enjoy their early years.

Children affected by conflict and displacement face especially difficult circumstances. Refugee children may lose their homes, family members, and access to basic services. Trauma during childhood can have long-term effects on mental health, academic performance, and social relationships. Supportive environments, trauma-informed care, and consistent routines can help children recover and regain a sense of safety.

In wealthier nations, new challenges have emerged. The widespread use of digital technology has transformed childhood. While smartphones, tablets, and the internet provide access to learning and entertainment, they also raise concerns about screen time, cyberbullying, and social isolation. Parents and educators must find ways to balance digital exposure with real-world interaction and physical activity.

Public policy plays a key role in protecting and promoting healthy childhoods. Governments are responsible for ensuring children's rights to education, healthcare, safety, and protection from exploitation. The United Nations Convention on the Rights of the Child (UNCRC), adopted in 1989, outlines these rights and obligates signatory countries to uphold them. Investment in early childhood development has been shown to yield significant returns in terms of reduced crime, improved productivity, and better social outcomes.

In recent years, there has been a growing emphasis on child participation — giving children a voice in decisions that affect their lives. Whether in the classroom, family, or legal system, listening to children and respecting their perspectives fosters self-esteem and a sense of agency.

In conclusion, childhood is a formative stage of life that shapes the person an individual becomes. It is a time of exploration, learning, and development, deeply influenced by family, culture, education, and environment. Ensuring that every child enjoys a safe, nurturing, and stimulating childhood is not only a moral obligation but also an investment in the future of society.`,
    questions: [
      {
        question: 'What is the main purpose of this passage?',
        explanation: "The author's main purpose is to give a broad overview of childhood — what it is, what influences it, and why it matters — arguing that a safe and nurturing childhood is both a moral duty and an investment in society's future.",
      },
      {
        question: 'According to the passage, how did traditional societies view children differently from modern industrialized societies?',
        explanation: 'Traditional societies viewed children as small adults expected to work from an early age. Modern industrialized societies, in contrast, treat childhood as a protected period for nurturing and education, free from adult responsibilities.',
      },
      {
        question: 'The word "resilience" in the passage is used in the context of parenting. What does it most likely mean?',
        explanation: 'In context, resilience means the ability to recover from difficulties. The passage states that warm, responsive parenting fosters resilience — meaning children raised in supportive environments are better able to cope with challenges.',
      },
      {
        question: "What can be inferred about the relationship between education and a child's future?",
        explanation: 'The passage implies a strong positive relationship: access to quality education during childhood is described as one of the most reliable predictors of future success, including higher earnings, better health, and civic participation.',
      },
      {
        question: 'According to the passage, what new challenges have emerged for children in wealthier nations?',
        explanation: 'The passage identifies digital technology as a new challenge — specifically concerns about excessive screen time, cyberbullying, and social isolation caused by widespread use of smartphones, tablets, and the internet.',
      },
      {
        question: 'What does the author suggest about investing in early childhood development?',
        explanation: 'The author suggests that investing in early childhood yields significant long-term returns for society, including reduced crime rates, improved productivity, and better social outcomes — making it both a moral obligation and a practical benefit.',
      },
    ],
  },

{
    id: 2,
    title: 'Child Care',
    topic: 'Society & Family',
    content: `2. Child Care Child care refers to the supervision and nurturing of children, typically from infancy to early school age, by individuals other than the child's parents. It plays a vital role in child development, family life, and modern economies. As more parents engage in full-time work or education, the need for reliable, affordable, and high-quality child care continues to grow. There are several types of child care arrangements. The most common include daycare centers, home-based care, nannies, and relatives providing informal care. Shahzod t.me/mindzod Each option varies in terms of cost, flexibility, quality, and accessibility. For many families, choosing the right child care involves balancing financial limitations with the desire to ensure a safe and stimulating environment for their children. High-quality child care provides more than just supervision—it contributes significantly to a child‘s social, emotional, cognitive, and physical development. In structured child care settings, children engage in activities that promote language skills, early literacy, and social interaction. Exposure to diverse environments and caregivers can also enhance adaptability and emotional intelligence. Governments and researchers recognize the importance of early childhood development, which begins well before formal schooling. Studies consistently show that children who attend quality child care programs are more likely to succeed academically, enjoy better health, and display stronger social skills later in life. As a result, many countries have implemented policies and subsidies to support child care services. However, access to quality child care is uneven, particularly in low-income communities or rural areas. In many countries, child care remains expensive and out of reach for families with limited resources. The cost of full-time child care often rivals or exceeds the average rent or mortgage payment, placing a significant financial burden on working parents—especially single mothers. Child care workers are essential but often underpaid. Despite their responsibility in shaping young minds, many early childhood educators receive low wages and limited benefits. This can lead to high staff turnover, which negatively affects consistency and attachment between children and caregivers. Improving the status and training of child care professionals is a priority for advocates of early childhood education. Health and safety are fundamental components of child care. Facilities must meet strict standards regarding hygiene, nutrition, emergency preparedness, and staff-to child ratios. Licensing, inspections, and background checks are mechanisms used to ensure compliance. During public health crises, such as the COVID-19 pandemic, child care centers had to adapt quickly to minimize risks while continuing to serve essential workers and families. Child care policies vary widely across countries. In Scandinavian nations, child care is often publicly funded and considered a universal right. Countries like Sweden and Norway offer generous parental leave followed by affordable, high quality early education programs. In contrast, countries such as the United States and United Kingdom rely more heavily on private providers, with limited public subsidies. Parental leave is closely related to child care. The availability and duration of paid leave affect when and how parents return to work, and whether they rely on child care services. In some cases, grandparents or extended family step in to help, especially in cultures where multigenerational living is common. Shahzod t.me/mindzod Technology is changing the landscape of child care. Apps and digital platforms allow parents to monitor their child‘s daily activities, communicate with caregivers, and access resources on child development. Some startups offer flexible or on-demand care options, which can be particularly useful for shift workers or freelancers. Yet, not all parents have the same needs or preferences. Some choose to care for their children at home due to cultural, religious, or personal beliefs. Others worry about the emotional impact of long hours in institutional settings. Quality home based care or co-operative arrangements between families are often seen as alternatives that provide both nurturing and structure. In addition to regular child care, after-school programs, summer camps, and early intervention services provide support for working parents and children with special needs. These programs can offer tutoring, sports, arts, and enrichment activities, reducing the risks associated with unsupervised time after school. The debate about who should bear the cost of child care continues. Some argue that governments should fund universal child care as a public good—just like primary education—because of its long-term benefits to society. Others believe that families should be responsible for making their own arrangements without relying on taxpayer support. This debate influences national budgets, election platforms, and labor policies. In conclusion, child care is a crucial aspect of modern life that affects children‘s development, gender equality, and economic productivity. While challenges remain—particularly regarding affordability, accessibility, and quality—investing in child care pays dividends for individuals and society. As the world changes, flexible, inclusive, and well-regulated child care systems will be essential for supporting families and shaping the next generation.`,
    questions: [
      {
        question: 'What is the main purpose of this passage?',
        explanation: 'The main purpose is to explain the role of child care in child development, family life, and economies, describe its types and benefits, highlight challenges such as cost, access, and worker conditions, compare policies across countries, and emphasize the value of investing in quality, flexible child care systems.',
      },
      {
        question: 'According to the passage, what are the most common types of child care arrangements?',
        explanation: 'The most common include daycare centers, home-based care, nannies, and relatives providing informal care.',
      },
      {
        question: 'The word uneven in paragraph 5 most likely means',
        explanation: 'Not equal or fairly distributed, as access to quality child care is particularly limited in low-income communities or rural areas.',
      },
      {
        question: 'What can be inferred about child care workers from the passage?',
        explanation: 'They are essential for shaping young minds but are often underpaid with low wages and limited benefits, leading to high staff turnover that harms consistency and attachment with children.',
      },
      {
        question: 'According to the passage, how do child care policies in Scandinavian nations differ from those in the United States and United Kingdom?',
        explanation: 'In Scandinavian nations, child care is often publicly funded and viewed as a universal right, with countries like Sweden and Norway providing generous parental leave and affordable high-quality early education; the United States and United Kingdom rely more on private providers with limited public subsidies.',
      },
      {
        question: 'What can be inferred about the long-term effects of quality child care programs?',
        explanation: 'Children who attend them are more likely to succeed academically, enjoy better health, and display stronger social skills later in life.',
      },
    ],
  },

];
