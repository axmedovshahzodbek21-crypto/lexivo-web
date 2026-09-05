// Icon for each `reason` value that can appear on an XP history entry.
// Previously three independent copies (XpModal, XpHistoryModal,
// ClassXpHistoryModal) each hand-maintained their own subset of this map —
// they'd drifted (e.g. only ClassXpHistoryModal's had 'Homework' and the
// lowercase mode-name keys; only XpHistoryModal's had 'Achievement'), so a
// reason recognized in one modal silently fell back to a generic icon in
// another. One shared map now covers the union of every reason seen across
// all three.
export const REASON_ICON: Record<string, string> = {
  Learn: '📖', learn: '📖',
  Flashcard: '🃏', Cards: '🃏', flashcard: '🃏',
  Quiz: '🧠', quiz: '🧠',
  Match: '🎯', match: '🎯',
  Reading: '📚', read: '📚',
  'SRS Review': '🔄',
  Structure: '🧩',
  Homework: '📋',
  'Streak Bonus': '🔥',
  'Level Complete': '🏆',
  Achievement: '⭐',
};
