// A proper Fisher-Yates shuffle. Previously duplicated (identically) in
// quiz/page.tsx and matching/page.tsx, while learn/page.tsx and
// flashcards/page.tsx used `[...arr].sort(() => Math.random() - 0.5)` in
// ~8 places instead — that comparator-based approach is a well-known biased
// shuffle (a sort comparator isn't a fair random permutation), so word order
// in those flows was subtly less random than the quiz/matching paths.
export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
