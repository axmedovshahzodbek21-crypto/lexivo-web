// Prototype content for the Debate Arena — Computer Games topic.
// Model: browse a full content bank per side, then pick a personal subset
// ("your case") to build, defend, and deliver. Battle-Ready tracks the
// pipeline steps, not full-bank completion.

export type VocabItem = { term: string; definition: string; example: string };
export type IdiomItem = { idiom: string; definition: string; example: string };
export type ArgumentItem = { claim: string; evidence: string; phrase: string };
export type RebuttalItem = { opposing: string; options: { text: string; correct: boolean }[] };

export type SideContent = {
  vocab: VocabItem[];
  idioms: IdiomItem[];
  phraseBank: string[]; // general-purpose opening/closing lines, not tied to one argument
  arguments: ArgumentItem[]; // full bank — user picks a subset for their case
  rebuttals: RebuttalItem[];
  modelCase: string; // "Model Opening" — a peekable example, not the user's own deliverable
};

export type DebateSide = 'for' | 'against';

export const DEBATE_CONTENT: Record<string, Record<DebateSide, SideContent>> = {
  'computer-games': {
    for: {
      vocab: [
        { term: 'strategic thinking', definition: 'planning several steps ahead to reach a goal', example: 'Strategy games force players to practice strategic thinking under time pressure.' },
        { term: 'hand-eye coordination', definition: 'the ability to make your hands react quickly to what your eyes see', example: 'Fast-paced action games noticeably improve hand-eye coordination over time.' },
        { term: 'immersive', definition: 'so engaging it feels like you are really inside it', example: 'Modern games are so immersive that players can lose track of time.' },
        { term: 'teamwork', definition: 'working together with others toward a shared goal', example: 'Multiplayer games demand real teamwork, not just individual skill.' },
        { term: 'stress relief', definition: 'something that helps you relax after a hard day', example: 'For many players, a short gaming session is a form of stress relief.' },
        { term: 'reflexes', definition: 'how fast your body reacts to something happening', example: 'Competitive gamers train their reflexes almost like athletes.' },
        { term: 'cognitive flexibility', definition: 'the mental ability to switch between ideas or strategies quickly', example: 'Games that change the rules mid-match build real cognitive flexibility.' },
        { term: 'digital literacy', definition: 'comfort and skill using digital tools and technology', example: 'Growing up gaming quietly builds strong digital literacy.' },
      ],
      idioms: [
        { idiom: 'level up', definition: 'to improve or advance to a better stage', example: 'Regular practice helped her level up both in the game and in real-world focus.' },
        { idiom: 'sharpen your skills', definition: 'to practice and improve an ability', example: 'Competitive gaming is one way young people sharpen their skills.' },
        { idiom: 'think on your feet', definition: 'to react quickly and cleverly in the moment', example: 'Fast-paced games teach players to think on their feet.' },
        { idiom: 'in the zone', definition: 'fully focused and performing at your best', example: 'Skilled players describe being completely in the zone during a match.' },
      ],
      phraseBank: [
        'This isn’t just entertainment — it’s a skill in disguise.',
        'Like any hobby, the key is balance, not banning it outright.',
        'The real question isn’t whether we play, but how we play.',
        'Judge the habit, not the hobby.',
        'The evidence tells a very different story than the stereotype.',
        'Let’s look at this from a different angle.',
      ],
      arguments: [
        { claim: 'Video games improve problem-solving skills.', evidence: 'Puzzle and strategy games force players to test solutions quickly and adapt — a skill that transfers to real decision-making.', phrase: 'Gaming isn’t idle time — it’s active problem-solving practice.' },
        { claim: 'Multiplayer games build real teamwork and communication.', evidence: 'Coordinating with teammates in real time, in a second language for many players, is genuine collaborative practice.', phrase: 'A raid or a match is a team project with a deadline of seconds, not weeks.' },
        { claim: 'Gaming offers accessible, healthy stress relief.', evidence: 'After a demanding day, a short session can lower stress the same way any absorbing hobby does.', phrase: 'Like reading or sport, gaming is simply how many people switch off.' },
        { claim: 'Fast-paced games sharpen reflexes and hand-eye coordination.', evidence: 'Action games require split-second reactions, and studies link this to faster visual processing.', phrase: 'Esports players train reaction time the same way athletes train their bodies.' },
        { claim: 'Gaming builds real digital literacy.', evidence: 'Navigating menus, settings, updates, and online communities builds comfort with technology used everywhere today.', phrase: 'Every hour spent gaming is also an hour spent getting fluent with technology.' },
        { claim: 'Esports offers real career and scholarship pathways.', evidence: 'Competitive gaming has created legitimate professional teams, university scholarships, and broadcasting careers.', phrase: 'This stopped being “just a game” the moment universities started offering scholarships for it.' },
      ],
      rebuttals: [
        { opposing: 'Games are addictive and harm mental health.', options: [
          { text: 'Moderation is the real issue, not gaming itself — most hobbies can become unhealthy if unchecked.', correct: true },
          { text: 'That is true, so nobody should play games.', correct: false },
          { text: 'Games are not popular, so this does not matter.', correct: false },
        ] },
        { opposing: 'Games promote violence in real life.', options: [
          { text: 'Decades of research have found no consistent causal link between violent games and real-world aggression.', correct: true },
          { text: 'Violent games are the best-selling genre.', correct: false },
          { text: 'Only children play violent games.', correct: false },
        ] },
        { opposing: 'Gaming encourages a sedentary lifestyle.', options: [
          { text: 'That is about screen habits in general, not gaming specifically — plenty of active games and breaks address it directly.', correct: true },
          { text: 'Sitting down is not bad for health.', correct: false },
          { text: 'Only adults sit while gaming.', correct: false },
        ] },
        { opposing: 'It distracts from schoolwork and sleep.', options: [
          { text: 'Any engaging hobby can do that without limits — the fix is a schedule, not banning the hobby.', correct: true },
          { text: 'Schoolwork is not actually important.', correct: false },
          { text: 'Games only happen after all homework is finished.', correct: false },
        ] },
        { opposing: 'Gaming is a waste of time.', options: [
          { text: 'Any hobby can be called a waste of time by someone who doesn’t enjoy it — the same logic would dismiss sport, reading, or music.', correct: true },
          { text: 'Time does not matter to teenagers.', correct: false },
          { text: 'Gaming takes no time at all.', correct: false },
        ] },
      ],
      modelCase:
        'Computer games are far more than entertainment — they build problem-solving skills, teach real teamwork through multiplayer coordination, and give people an accessible way to relax. Like any hobby, moderation matters, but that’s an argument for balance, not for dismissing gaming’s real benefits.',
    },
    against: {
      vocab: [
        { term: 'addictive', definition: 'causing a strong, hard-to-stop urge to keep doing something', example: 'Many free-to-play games are designed to be addictive through daily rewards.' },
        { term: 'sedentary', definition: 'involving a lot of sitting and little physical activity', example: 'Long gaming sessions can lead to a sedentary lifestyle.' },
        { term: 'isolation', definition: 'being cut off from other people', example: 'Some heavy gamers report feelings of isolation from real-life friends.' },
        { term: 'screen time', definition: 'the amount of time spent looking at a screen', example: 'Parents often try to limit their children’s daily screen time.' },
        { term: 'dependency', definition: 'needing something so much you struggle without it', example: 'Doctors are studying gaming dependency as a genuine clinical concern.' },
        { term: 'distraction', definition: 'something that takes your attention away from what matters', example: 'For students, gaming can become a constant distraction from studying.' },
        { term: 'overstimulation', definition: 'a state of being overwhelmed by too much sensory input', example: 'Hours of fast-paced gaming can leave players in a state of overstimulation.' },
        { term: 'burnout', definition: 'extreme mental or physical exhaustion from overdoing something', example: 'Professional gamers themselves have spoken openly about burnout.' },
      ],
      idioms: [
        { idiom: 'hooked on', definition: 'unable to stop doing or using something', example: 'Many teenagers admit to being hooked on their favourite game.' },
        { idiom: 'glued to the screen', definition: 'staying focused on a screen for a long time without moving', example: 'Parents worry about kids being glued to the screen for hours.' },
        { idiom: 'lose track of time', definition: 'to not notice how much time has passed', example: 'It is easy to lose track of time once you start playing.' },
        { idiom: 'cut off from the world', definition: 'isolated from other people and real life', example: 'Excessive gaming can leave someone feeling cut off from the world.' },
      ],
      phraseBank: [
        'Let’s not confuse fun with harmless.',
        'The numbers don’t lie.',
        'This is a habit dressed up as a hobby.',
        'We’re trading real life for a screen.',
        'Moderation is easy to recommend, harder to enforce.',
        'The cost shows up later, not immediately.',
      ],
      arguments: [
        { claim: 'Many games are designed to be addictive.', evidence: 'Reward loops and daily streaks are built to keep players playing far longer than they intended.', phrase: 'These games are engineered to be hard to put down — that’s not an accident.' },
        { claim: 'Gaming encourages a sedentary lifestyle.', evidence: 'Hours spent sitting reduce physical activity, which is linked to long-term health problems.', phrase: 'Hours in a chair every day adds up to a real health cost.' },
        { claim: 'Excessive gaming can cause social isolation.', evidence: 'Time spent gaming alone often replaces face-to-face interaction with friends and family.', phrase: 'A screen is not a substitute for a real conversation.' },
        { claim: 'It distracts from schoolwork and sleep.', evidence: 'Surveys of teenagers consistently link late-night gaming to lower grades and poorer sleep.', phrase: 'Late-night sessions are borrowing from tomorrow’s focus and grades.' },
        { claim: 'It can lead to overstimulation and burnout.', evidence: 'Constant high-intensity sessions can leave players mentally exhausted and irritable.', phrase: 'A brain that never switches off eventually pays for it.' },
        { claim: 'It has real, sometimes hidden, financial costs.', evidence: 'Microtransactions and loot boxes can lead to significant spending, often without players noticing the total.', phrase: 'The game is free to download and expensive to actually play.' },
      ],
      rebuttals: [
        { opposing: 'Games build problem-solving skills.', options: [
          { text: 'Those skills rarely transfer beyond the game itself, while the same hours could build real-world skills instead.', correct: true },
          { text: 'Problem-solving does not matter in real life.', correct: false },
          { text: 'Games have no puzzles at all.', correct: false },
        ] },
        { opposing: 'Games relieve stress.', options: [
          { text: 'Excessive use often increases anxiety and disrupts sleep, worsening the very stress it claims to relieve.', correct: true },
          { text: 'Stress relief is not important for teenagers.', correct: false },
          { text: 'No one feels stressed after playing.', correct: false },
        ] },
        { opposing: 'Multiplayer games build real teamwork.', options: [
          { text: 'Coordinating in a game is not the same as the social skills built through in-person collaboration.', correct: true },
          { text: 'Teamwork is not a useful skill.', correct: false },
          { text: 'Multiplayer games do not exist.', correct: false },
        ] },
        { opposing: 'Gaming sharpens reflexes and coordination.', options: [
          { text: 'That narrow benefit does not offset the broader cost to physical activity and sleep.', correct: true },
          { text: 'Reflexes are not useful for anything.', correct: false },
          { text: 'Only professional gamers have reflexes.', correct: false },
        ] },
        { opposing: 'Esports offers real careers.', options: [
          { text: 'Only a tiny fraction of players ever earn anything from it, while the hours invested rarely pay off for everyone else.', correct: true },
          { text: 'No one has ever earned money from esports.', correct: false },
          { text: 'Esports is not competitive.', correct: false },
        ] },
      ],
      modelCase:
        'While games can be fun in moderation, excessive gaming is genuinely harmful — it’s designed to be addictive, keeps people sedentary, isolates them from real relationships, and eats into time needed for school and sleep. The benefits some claim rarely outweigh these costs.',
    },
  },
};
