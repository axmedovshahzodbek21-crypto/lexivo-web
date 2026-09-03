'use client';
import { PageLoader, SectionLoader } from '@/components/Loader';
import { useEffect, useRef, useState, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { useShallow } from 'zustand/react/shallow';
import { speakAccent, speakText } from '@/lib/speech';
import {
  saveLearnedWord, incrementTodayCount, addXP, recordStudySession,
  markLearningComplete, toggleStarred, isStarred, addHardWord,
  getHardWords, removeHardWord, getSettings, getStreak, getTodayLearnedCount,
  saveLearnProgress, clearLearnProgress, getLearnProgress,
  saveLearnMarks, getLearnMarks, getStarredWords, getLearnXPAmount, displayXP,
  getClassHWTemp,
} from '@/lib/storage';
import { pushLists, pushStats } from '@/lib/sync';
import { supabase } from '@/lib/supabase';
import { createSRSWord } from '@/lib/srs';
import { addSRSWord as storeSRSWord } from '@/lib/storage';
import { recordClassWordLearned, addClassHardWord, addClassStarredWord, removeClassStarredWord, getClassStarredWordIds } from '@/lib/class-srs';
import { recordClassStudyDay } from '@/lib/class-xp';
import type { Accent } from '@/lib/speech';
import { checkAchievements } from '@/lib/gamification';
import { fireConfetti } from '@/lib/confetti';
import { shuffleArray } from '@/lib/shuffleArray';
import type { WordItem, WordCollection } from '@/lib/types';
import { getImportedWords, getImportedWordsByCollection, importedWordExampleFields, getMyActivityPendingNewWords, markMyLearnComplete } from '@/lib/storage';
import Link from 'next/link';
import UnitPicker from '@/components/UnitPicker';
import TiltCard from '@/components/TiltCard';
import { useTranslation } from '@/lib/useTranslation';

interface StudyWord extends WordItem {
  collectionName: string;
  topic: string;
  dayNumber: number;
}

// Shared by both "Got it" and "Too Hard" — a word marked Too Hard earns the
// same XP and goes into SRS exactly like a word marked Learned. This is
// deliberate: if Too Hard didn't reward like Learned, students under peer
// pressure (leaderboards, streaks) would just mark everything Learned to
// avoid losing out, making the app's difficulty signal to teachers useless.
// Too Hard's only difference is it *also* lands in the separate Hard Words
// list (addHardWord, called by the caller) so the student and their teacher
// can still see which words were a genuine struggle.
async function grantLearnReward(
  word: StudyWord,
  opts: { sourceClass: boolean; sourceClassHW: boolean; classIdParam: string },
): Promise<boolean> {
  let isNew: boolean;
  if (opts.sourceClass || opts.sourceClassHW) {
    // Class mode is its own world: SRS lives in Supabase, and class work does
    // NOT feed any personal Lexivo signal — not the daily word-goal counter
    // (incrementTodayCount), not XP, not the study streak. Only the class's
    // own progress/streak/leaderboard move. Matches the Flutter app.
    isNew = false;
    if (opts.classIdParam) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        try {
          // Inserts the SRS row and awards XP atomically server-side, so a
          // tampered client can't replay this call against an already-learned
          // word for repeat XP — see record_class_word_learned in
          // supabase/migrations. isNew reflects Postgres's own dedup check,
          // not a client assertion.
          //
          // Homework-sourced sessions (sourceClassHW) also fire a single
          // bulk record_class_homework_progress call at session finish that
          // awards word_count * 10 class XP for 'learn' mode — passing the
          // real per-word XP here too would double-pay class_xp for the same
          // words. Pass 0 so this call still creates/upserts the SRS row and
          // isNew still reflects Postgres's dedup, but the bulk award at
          // session end is the sole class-XP source, matching how
          // flashcard/quiz/match already avoid this with !sourceClassHW.
          const xp = opts.sourceClassHW ? 0 : getLearnXPAmount();
          isNew = await recordClassWordLearned(user.id, opts.classIdParam, word.word, word.translation, xp);
        } catch {
          // Sync failed (network/RPC) — don't strand the student on this
          // card; the lesson still advances, just without server credit.
        }
      }
    }
  } else {
    isNew = saveLearnedWord({
      word: word.word,
      translation: word.translation,
      collectionName: word.collectionName,
      topic: word.topic,
      dayNumber: word.dayNumber,
      learnedAt: new Date().toISOString(),
    });
    const srsWord = createSRSWord(word, word.collectionName, word.dayNumber, word.topic);
    storeSRSWord(srsWord);
    if (isNew) incrementTodayCount();
  }
  return isNew;
}

function buildStudyList(
  collections: WordCollection[],
  collectionName?: string,
  dayNumber?: number,
  hardOnly?: boolean,
  order: 'random' | 'in-order' = 'random',
): StudyWord[] {
  const hardSet = hardOnly ? new Set(getHardWords()) : null;
  const words: StudyWord[] = [];
  for (const col of collections) {
    if (collectionName && col.name !== collectionName) continue;
    for (const day of col.days) {
      if (dayNumber !== undefined && day.dayNumber !== dayNumber) continue;
      for (const word of day.words) {
        if (hardSet && !hardSet.has(word.word)) continue;
        words.push({ ...word, collectionName: col.name, topic: day.topic, dayNumber: day.dayNumber });
      }
    }
  }
  if (order === 'random') {
    for (let i = words.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [words[i], words[j]] = [words[j], words[i]];
    }
  }
  return words;
}

function LearnInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const sourceMyWords = sp.get('source') === 'my-words';
  const sourceStarred = sp.get('source') === 'starred';
  const sourceClass = sp.get('source') === 'class';
  const sourceClassHW = sp.get('source') === 'class-hw';
  const classIdParam = sp.get('classId') ?? '';
  const classNameParam = sp.get('className') ?? 'Class';
  const starredUnitIndex = parseInt(sp.get('unit') ?? '1') - 1; // 0-based
  const myCollection = sp.get('myCollection') ?? undefined;
  const myFolder     = sp.get('myFolder') ?? undefined;
  const onlyNew = sp.get('onlyNew') === '1';
  const rawCollectionName = sp.get('collection') ?? undefined;
  const dayParam = sp.get('day');
  const dayNumber = dayParam ? parseInt(dayParam) : undefined;
  const hardOnly = sp.get('hard') === 'true';
  const startIndexParam = sp.get('startIndex');
  const startIndex = startIndexParam ? parseInt(startIndexParam) || 0 : 0;
  const { collections, collectionsLoaded, pushAchievement, setPendingLevelUp, focusMode, setFocusMode, showPomodoroSetup } = useAppStore(
    useShallow(s => ({
      collections: s.collections, collectionsLoaded: s.collectionsLoaded,
      pushAchievement: s.pushAchievement, setPendingLevelUp: s.setPendingLevelUp,
      focusMode: s.focusMode, setFocusMode: s.setFocusMode,
      showPomodoroSetup: s.showPomodoroSetup,
    }))
  );

  // Validate the URL param against known collection names so arbitrary strings
  // cannot corrupt localStorage keys or reach Supabase queries. Before collections
  // are loaded we pass the raw value through unchanged so no flash of <UnitPicker>.
  const collectionName = useMemo(() => {
    if (!collectionsLoaded) return rawCollectionName;
    if (!rawCollectionName) return undefined;
    return collections.some(c => c.name === rawCollectionName) ? rawCollectionName : undefined;
  }, [rawCollectionName, collections, collectionsLoaded]);

  const [words, setWords] = useState<StudyWord[]>([]);
  const [index, setIndex] = useState(0);
  const [startIndexApplied, setStartIndexApplied] = useState(false);
  const [resumePrompt, setResumePrompt] = useState<{ savedIndex: number; total: number; tooHard: string[]; skipped: string[] } | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showEx1Translation, setShowEx1Translation] = useState(false);
  const [showEx2Translation, setShowEx2Translation] = useState(false);
  const [showEx3Translation, setShowEx3Translation] = useState(false);
  const [showUzDefinition, setShowUzDefinition] = useState(false);
  const [showMoreExamples, setShowMoreExamples] = useState(false);
  const [skipped, setSkipped] = useState<StudyWord[]>([]);
  const [pureSkipped, setPureSkipped] = useState<StudyWord[]>([]);
  const [marks, setMarks] = useState<('learned' | 'skipped' | 'too-hard' | null)[]>([]);
  const [maxReached, setMaxReached] = useState(0);
  const [done, setDone] = useState(false);
  const [myUnitCompleted, setMyUnitCompleted] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [sessionXP, setSessionXP] = useState(0);
  // Transient "+N XP" chip shown above the action bar each time a word is
  // credited, so XP visibly accrues per card rather than only as a total on
  // the finish screen. `id` re-keys the element so the CSS animation replays;
  // the timer is tokenised so a fast run of marks can't clear a newer chip.
  const [xpFlash, setXpFlash] = useState<{ amount: number; id: number } | null>(null);
  const xpFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashXp = useCallback((amount: number) => {
    if (amount <= 0) return;
    const id = Date.now();
    setXpFlash({ amount, id });
    if (xpFlashTimer.current) clearTimeout(xpFlashTimer.current);
    xpFlashTimer.current = setTimeout(() => setXpFlash(null), 1300);
  }, []);
  const [starred, setStarredState] = useState(false);
  // In a class session the star / Too Hard buttons act on the CLASS lists
  // (class_starred_words / class_hard_words) — never the personal ones — so
  // the teacher sees them and they don't pollute personal Starred/Hard Words.
  const [classStarred, setClassStarred] = useState<Set<string>>(new Set());
  const [defaultAccent, setDefaultAccent] = useState<Accent>('us');
  const [autoPlayOnReveal, setAutoPlayOnReveal] = useState(true);
  const [sessionSize, setSessionSize] = useState(20);
  const [studyOrder, setStudyOrder] = useState<'random' | 'in-order'>('random');
  const [showSkipTip, setShowSkipTip] = useState(false);
  const [classWordsLoaded, setClassWordsLoaded] = useState(false);

  // Anti-cheat state
  const [revealCountdown, setRevealCountdown] = useState(0);
  const [inQuizGate, setInQuizGate] = useState(false);
  const [gateOptions, setGateOptions] = useState<string[]>([]);
  const [gateCorrectIndex, setGateCorrectIndex] = useState(-1);
  const [gateSelected, setGateSelected] = useState<number | null>(null);
  const [inSpotCheck, setInSpotCheck] = useState(false);
  const [spotCheckWord, setSpotCheckWord] = useState<StudyWord | null>(null);
  const [spotCheckOptions, setSpotCheckOptions] = useState<string[]>([]);
  const [spotCheckCorrectIndex, setSpotCheckCorrectIndex] = useState(-1);
  const [spotCheckSelected, setSpotCheckSelected] = useState<number | null>(null);
  const [learnedSinceLastCheck, setLearnedSinceLastCheck] = useState(0);
  const currentIndexRef = useRef(index);
  useEffect(() => { currentIndexRef.current = index; }, [index]);
  const doneRef = useRef(done);
  useEffect(() => { doneRef.current = done; }, [done]);
  // Mirrored into refs so the once-on-unmount save below (empty deps) reads
  // the latest marks when the student leaves a class session by any route —
  // browser back, tab close, or the header ← button.
  const skippedRef = useRef(skipped);
  useEffect(() => { skippedRef.current = skipped; }, [skipped]);
  const pureSkippedRef = useRef(pureSkipped);
  useEffect(() => { pureSkippedRef.current = pureSkipped; }, [pureSkipped]);

  // ── Phase 5: analytics tracking refs (no re-renders) ──────────────────────
  // Reset when words array is first populated (fires once per session load)
  const sessionStartRef = useRef<number>(Date.now());
  const wordStartRef = useRef<number>(Date.now());
  type WordOutcome = { word: string; outcome: string; seconds_to_mark: number; gate_attempts: number; gate_correct_first: boolean };
  const perWordDataRef = useRef<WordOutcome[]>([]);
  const wordGateAttemptsRef = useRef(0);
  const wordGateCorrectFirstRef = useRef(true);

  useEffect(() => {
    if (words.length === 0) return;
    perWordDataRef.current = [];
    sessionStartRef.current = Date.now();
  }, [words]);

  const t = useTranslation();

  useEffect(() => {
    const s = getSettings();
    setDefaultAccent(s.defaultAccent);
    setAutoPlayOnReveal(s.autoPlayOnReveal);
    setSessionSize(s.sessionSize);
    setStudyOrder(s.studyOrder);
    if (!localStorage.getItem('lexivo_seen_skip_tip')) {
      setShowSkipTip(true);
    }
  }, []);

  // Show Pomodoro widget whenever Learn is entered (collection picker or unit session)
  // setTimeout defers past the hydration window to avoid React Error #310
  useEffect(() => {
    const t = setTimeout(() => showPomodoroSetup(), 0);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (sourceStarred && collectionsLoaded && collections.length > 0) {
      const starredList = getStarredWords();
      const unitWords = starredList.slice(starredUnitIndex * 30, (starredUnitIndex + 1) * 30);
      const unitSet = new Set(unitWords);
      const list: StudyWord[] = [];
      for (const col of collections) {
        for (const day of col.days) {
          for (const word of day.words) {
            if (unitSet.has(word.word)) {
              list.push({ ...word, collectionName: 'starred_words', topic: `Unit ${starredUnitIndex + 1}`, dayNumber: starredUnitIndex + 1 });
            }
          }
        }
      }
      list.sort((a, b) => unitWords.indexOf(a.word) - unitWords.indexOf(b.word));
      setWords(list);
      setMarks(new Array(list.length).fill(null));
      return;
    }
    if (sourceMyWords) {
      let imported = myCollection ? getImportedWordsByCollection(myCollection, myFolder) : getImportedWords();
      if (onlyNew && myCollection) {
        const pending = new Set(getMyActivityPendingNewWords(myFolder, myCollection, 'learn', imported.map(w => w.word)));
        imported = imported.filter(w => pending.has(w.word));
      }
      const list: StudyWord[] = imported.map(w => ({
        word: w.word,
        partOfSpeech: w.partOfSpeech ?? '',
        pronunciation: w.pronunciation ?? '',
        translation: w.translation,
        definition: w.definition,
        definitionUz: w.definitionUz,
        ...importedWordExampleFields(w),
        language: w.language,
        collectionName: 'my-words',
        topic: myCollection ?? 'My Words',
        dayNumber: 0,
      }));
      const shuffled = studyOrder === 'random'
        ? shuffleArray(list)
        : list;
      const mySlice = shuffled.slice(0, sessionSize);
      setWords(mySlice);
      setMarks(new Array(mySlice.length).fill(null));
      return;
    }
    if (collectionsLoaded && collections.length > 0) {
      const list = buildStudyList(collections, collectionName, dayNumber, hardOnly, studyOrder);
      const sliced = (dayNumber !== undefined || hardOnly) ? list : list.slice(0, sessionSize);
      setWords(sliced);
      setMarks(new Array(sliced.length).fill(null));
      if (startIndex > 0 && !startIndexApplied) {
        if (sliced.length > 0) {
          setIndex(Math.min(Math.max(0, startIndex), sliced.length - 1));
        }
        setStartIndexApplied(true);
      } else if (collectionName && dayNumber !== undefined && !startIndexApplied) {
        const saved = getLearnProgress(collectionName, dayNumber);
        if (saved && saved > 0 && saved < sliced.length) {
          const savedMarks = getLearnMarks(collectionName, dayNumber);
          setResumePrompt({
            savedIndex: saved,
            total: sliced.length,
            tooHard: savedMarks?.tooHard ?? [],
            skipped: savedMarks?.skipped ?? [],
          });
        }
      }
    }
  }, [collectionsLoaded, collections, collectionName, dayNumber, hardOnly, sourceMyWords, sourceStarred, starredUnitIndex, myCollection, myFolder, onlyNew]);

  useEffect(() => {
    if (!sourceClass || !classIdParam) return;
    (async () => {
      const { data } = await supabase
        .from('class_words')
        .select('word, translation, definition, example1, example1_translation, example2, example2_translation, examples')
        .eq('class_id', classIdParam)
        .order('created_at', { ascending: true });
      const rows = (data as any[]) ?? [];
      const list: StudyWord[] = rows.map(row => {
        const exs: { sentence: string; translation: string }[] = row.examples ?? [];
        return {
          word: row.word,
          partOfSpeech: '',
          pronunciation: '',
          translation: row.translation,
          definition: row.definition ?? '',
          definitionUz: '',
          example1: exs[0]?.sentence ?? row.example1 ?? '',
          example1Situation: '',
          example1Translation: exs[0]?.translation ?? row.example1_translation ?? '',
          example2: exs[1]?.sentence ?? row.example2 ?? '',
          example2Situation: '',
          example2Translation: exs[1]?.translation ?? row.example2_translation ?? '',
          example3: exs[2]?.sentence ?? '',
          example3Situation: '',
          example3Translation: exs[2]?.translation ?? '',
          extraExamples: exs.slice(3).map(e => e.sentence).filter(Boolean),
          extraExampleTranslations: exs.slice(3).map(e => e.translation),
          language: undefined,
          collectionName: classNameParam,
          topic: classNameParam,
          dayNumber: 0,
        };
      });
      // Class Learn progress is keyed on (className, day 0) — the same scheme
      // as regular collections. When the student has a saved position, keep
      // the words in their stable created_at order so "word N" still points
      // at the same card they left on; only shuffle a fresh session.
      const savedIdx = getLearnProgress(classNameParam, 0);
      const resuming = savedIdx != null && savedIdx > 0 && savedIdx < list.length;
      const ordered = (studyOrder === 'random' && !resuming)
        ? shuffleArray(list)
        : list;
      setWords(ordered);
      setMarks(new Array(ordered.length).fill(null));
      setClassWordsLoaded(true);
      if (resuming) {
        const savedMarks = getLearnMarks(classNameParam, 0);
        setResumePrompt({
          savedIndex: savedIdx!,
          total: ordered.length,
          tooHard: savedMarks?.tooHard ?? [],
          skipped: savedMarks?.skipped ?? [],
        });
      }
    })();
  }, [sourceClass, classIdParam]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load the class's starred-word set so the star button reflects/toggles it
  // (covers both `class` and `class-hw`, which both carry ?classId).
  useEffect(() => {
    if ((!sourceClass && !sourceClassHW) || !classIdParam) return;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) getClassStarredWordIds(user.id, classIdParam).then(setClassStarred).catch(() => {});
    });
  }, [sourceClass, sourceClassHW, classIdParam]);

  useEffect(() => {
    if (!sourceClassHW) return;
    const hw = getClassHWTemp();
    const list: StudyWord[] = hw.map(w => ({
      word: w.word, partOfSpeech: w.partOfSpeech ?? '', pronunciation: w.pronunciation ?? '',
      translation: w.translation, definition: w.definition, definitionUz: w.definitionUz ?? '',
      example1: w.example1, example1Situation: '', example1Translation: w.example1Translation,
      example2: w.example2, example2Situation: '', example2Translation: w.example2Translation,
      example3: w.example3 ?? '', example3Situation: '', example3Translation: w.example3Translation ?? '',
      extraExamples: w.extraExamples ?? [], extraExampleTranslations: w.extraExampleTranslations ?? [],
      collectionName: w.className, topic: w.className, dayNumber: 0,
    }));
    setWords(shuffleArray(list));
    setMarks(new Array(list.length).fill(null));
    setClassWordsLoaded(true);
  }, [sourceClassHW]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = words[index];

  useEffect(() => {
    if (current) {
      setStarredState((sourceClass || sourceClassHW) ? classStarred.has(current.word) : isStarred(current.word));
      setRevealed(false);
      setShowHint(false);
      setShowEx1Translation(false);
      setShowEx2Translation(false);
      setShowEx3Translation(false);
      setShowUzDefinition(false);
      setShowMoreExamples(false);
      setRevealCountdown(0);
      setInQuizGate(false);
      setGateSelected(null);
      setInSpotCheck(false);
      setSpotCheckSelected(null);
      wordStartRef.current = Date.now();
      wordGateAttemptsRef.current = 0;
      wordGateCorrectFirstRef.current = true;
    }
  }, [current, sourceClass, sourceClassHW, classStarred]);

  useEffect(() => {
    if (revealed && current && autoPlayOnReveal) {
      if (current.language) speakText(current.word, current.language);
      else speakAccent(current.word, defaultAccent);
    }
  }, [revealed]); // intentionally only on revealed change

  useEffect(() => {
    if (!revealed) return;
    setRevealCountdown(3);
    const id = setInterval(() => {
      setRevealCountdown(c => {
        if (c <= 1) { clearInterval(id); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [revealed]); // restart countdown whenever a new reveal happens

  // ── Heartbeat: upsert student_presence every 30s while session is active ──
  useEffect(() => {
    if (done || words.length === 0) return;
    const upsert = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('student_presence').upsert({
        student_id: user.id,
        activity: 'learn',
        collection_name: sourceClass ? classNameParam : (collectionName ?? null),
        day_number: sourceClass ? null : (dayNumber ?? null),
        started_at: new Date(sessionStartRef.current).toISOString(),
        last_heartbeat: new Date().toISOString(),
      }, { onConflict: 'student_id' });
    };
    upsert();
    const id = setInterval(upsert, 30_000);
    return () => clearInterval(id);
  }, [done, words.length, collectionName, dayNumber, sourceClass, classNameParam]);

  // Delete the presence row only on a true unmount (navigating away
  // mid-session), not on every re-run of the upsert effect above — that
  // effect's deps (collectionName/dayNumber/words.length) can legitimately
  // change while the session is still active (e.g. once URL params finish
  // resolving), and deleting+recreating the row on every such change caused
  // a brief visibility gap on the teacher's "studying now" dashboard. Empty
  // deps + a ref for the delete body so this really only fires once, on
  // unmount, using whatever the latest values were.
  useEffect(() => {
    return () => {
      if (doneRef.current) return;
      // Persist the class session position on any exit route (not just the
      // header ← button), so re-entering offers "resume where you left off".
      if (sourceClass && currentIndexRef.current > 0) {
        saveLearnProgress(classNameParam, 0, currentIndexRef.current);
        saveLearnMarks(classNameParam, 0,
          skippedRef.current.map(w => w.word), pureSkippedRef.current.map(w => w.word));
      }
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) supabase.from('student_presence').delete().eq('student_id', user.id).then(() => {});
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Emit session analytics when done ──────────────────────────────────────
  useEffect(() => {
    if (!done || words.length === 0) return;
    const emit = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const wordsLearned = marks.filter(m => m === 'learned').length;
      const wordsSkipped = marks.filter(m => m === 'skipped').length;
      const wordsHard = marks.filter(m => m === 'too-hard').length;
      const sessionSeconds = Math.round((Date.now() - sessionStartRef.current) / 1000);
      const gateAttempts = perWordDataRef.current.reduce((s, w) => s + w.gate_attempts, 0);
      const gateCorrectFirst = perWordDataRef.current.filter(w => w.outcome === 'learned' && w.gate_correct_first).length;
      await supabase.from('learn_session_analytics').insert({
        student_id: user.id,
        collection_name: sourceClass ? classNameParam : (collectionName ?? 'all'),
        day_number: sourceClass ? 0 : (dayNumber ?? 0),
        started_at: new Date(sessionStartRef.current).toISOString(),
        completed_at: new Date().toISOString(),
        total_words: words.length,
        words_learned: wordsLearned,
        words_skipped: wordsSkipped,
        words_hard: wordsHard,
        session_seconds: sessionSeconds,
        gate_attempts: gateAttempts,
        gate_correct_first_try: gateCorrectFirst,
        per_word_data: perWordDataRef.current,
      });
      await supabase.from('student_presence').delete().eq('student_id', user.id);
    };
    emit();
  }, [done, marks, words, collectionName, dayNumber]);

  // Shared tail end of both "Got it" and "Too Hard" — XP, streak bookkeeping,
  // achievements, and unit-completion detection are identical for both
  // outcomes; only the analytics tag and the Hard Words side-effect differ
  // (handled by the caller before this runs).
  const finishWordMark = useCallback((outcome: 'learned' | 'too-hard', isNew: boolean, gateAttempts: number, gateCorrectFirst: boolean) => {
    if (!current) return;
    if (isNew && !sourceClassHW && !sourceClass) {
      const learnXP = getLearnXPAmount();
      const { leveledUp, newLevel, newXp } = addXP(learnXP, 'Learn', `Unit ${current.dayNumber} · ${current.collectionName}`);
      if (leveledUp) setPendingLevelUp({ level: newLevel, xp: newXp });
      setSessionXP(prev => prev + learnXP);
      flashXp(learnXP);
      // XP and the learned-word itself (saveLearnedWord, above in
      // grantLearnReward) are credited locally as soon as each word is
      // marked, but used to only reach the cloud via the pushStats()/
      // pushLists() calls at the very end of the session (index + 1 >=
      // words.length below) — a student who closed the tab or navigated
      // away before finishing the whole list would have every word already
      // learned in this session stuck in localStorage forever, never
      // syncing to the leaderboard or other devices. Pushing right after
      // each award closes that gap.
      pushStats();
      pushLists();
    } else if (isNew && (sourceClassHW || sourceClass) && classIdParam) {
      // Class XP is isolated to the class leaderboard — it must NOT also
      // land in the personal Lexivo pool (lexivo_xp / level / global
      // leaderboard). The class-side award already happened atomically
      // inside grantLearnReward's recordClassWordLearned call; here we only
      // reflect it in this session's own "+N XP" display. Matches the
      // Flutter app and lib/class-xp.ts's "intentionally isolated" contract.
      const learnXP = getLearnXPAmount();
      setSessionXP(prev => prev + learnXP);
      flashXp(learnXP);
    }
    // Personal Lexivo study streak — class work is its own world and must not
    // keep the personal streak alive (the class has its own study-day streak).
    if (!sourceClass && !sourceClassHW) recordStudySession();
    setSessionCount(c => c + 1);
    perWordDataRef.current.push({
      word: current.word,
      outcome,
      seconds_to_mark: Math.round((Date.now() - wordStartRef.current) / 1000),
      gate_attempts: gateAttempts,
      gate_correct_first: gateCorrectFirst,
    });
    setMarks(m => { const n = [...m]; n[index] = outcome; return n; });
    if (!sourceClassHW && !sourceClass) {
      const newAch = checkAchievements();
      newAch.forEach(pushAchievement);
    }
    if (index + 1 >= words.length) {
      if (collectionName && words.length > 0) {
        markLearningComplete(collectionName, words[0].dayNumber);
        clearLearnProgress(collectionName, words[0].dayNumber);
      } else if (sourceClass) {
        clearLearnProgress(classNameParam, 0);
      } else if (sourceMyWords && myCollection) {
        if (markMyLearnComplete(myFolder, myCollection)) { setMyUnitCompleted(true); fireConfetti(); }
      }
      pushLists();
      pushStats();
      if (sourceClass && classIdParam) {
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (user) void recordClassStudyDay(user.id, classIdParam);
        });
      }
      if (sourceClassHW && sp.get('hwId')) {
        // Record completion the moment the session actually finishes, not
        // gated behind a "Back"/"Continue" link's ?completed= query param —
        // that path was skipped entirely by browser-back or closing the tab,
        // silently losing the student's progress and XP. This matters even
        // more for Learn specifically: on class-hw it auto-chains straight
        // into Flashcards via classHWNextUrl, so a student who finishes
        // Learn and then abandons before finishing Flashcards would
        // otherwise never have Learn recorded at all (it previously only
        // rode along as Flashcards' ?alsoCompleted=learn).
        void supabase.rpc('record_class_homework_progress', {
          p_homework_id: sp.get('hwId'), p_mode: 'learn', p_client_word_count: words.length,
        });
      }
      setDone(true);
    } else {
      setIndex(i => i + 1);
      setMaxReached(m => Math.max(m, index + 1));
    }
  }, [current, index, words, collectionName, pushAchievement, setPendingLevelUp, sourceClass, sourceClassHW, classIdParam, classNameParam, sourceMyWords, myCollection, myFolder, sp, flashXp]);

  const advanceCard = useCallback(async () => {
    if (!current) return;
    if (hardOnly) removeHardWord(current.word);
    const isNew = await grantLearnReward(current, { sourceClass, sourceClassHW, classIdParam });
    finishWordMark('learned', isNew, wordGateAttemptsRef.current, wordGateCorrectFirstRef.current);
  }, [current, hardOnly, sourceClass, sourceClassHW, classIdParam, finishWordMark]);

  const tryAdvanceCard = useCallback(() => {
    if (!current || !revealed || revealCountdown > 0 || inQuizGate || inSpotCheck) return;
    if (marks[index] === 'learned') { advanceCard(); return; } // already marked — bypass gate
    if (words.length < 2) { advanceCard(); return; }
    const correct = current.translation;
    const pool = shuffleArray(words.filter(w => w.word !== current.word));
    const opts = shuffleArray([correct, ...pool.slice(0, 3).map(w => w.translation)]);
    setGateOptions(opts);
    setGateCorrectIndex(opts.indexOf(correct));
    setGateSelected(null);
    setInQuizGate(true);
    wordGateAttemptsRef.current += 1;
  }, [current, revealed, revealCountdown, inQuizGate, inSpotCheck, marks, index, words, advanceCard]);

  const selectGateAnswer = useCallback((idx: number) => {
    if (gateSelected !== null) return;
    const capturedIndex = index;
    setGateSelected(idx);
    if (idx === gateCorrectIndex) {
      setTimeout(() => {
        if (currentIndexRef.current !== capturedIndex) return;
        const next = learnedSinceLastCheck + 1;
        if (next >= 3) {
          const learnedWords = words.filter((_, i) => marks[i] === 'learned');
          if (learnedWords.length > 0) {
            const checkWord = learnedWords[Math.floor(Math.random() * learnedWords.length)];
            const correct = checkWord.translation;
            const pool = shuffleArray(words.filter(w => w.word !== checkWord.word));
            const opts = shuffleArray([correct, ...pool.slice(0, 3).map(w => w.translation)]);
            setLearnedSinceLastCheck(0);
            setSpotCheckWord(checkWord);
            setSpotCheckOptions(opts);
            setSpotCheckCorrectIndex(opts.indexOf(correct));
            setSpotCheckSelected(null);
            setInQuizGate(false);
            setInSpotCheck(true);
            return;
          }
        }
        setLearnedSinceLastCheck(next >= 3 ? 0 : next);
        setInQuizGate(false);
        advanceCard();
      }, 700);
    } else {
      wordGateCorrectFirstRef.current = false;
      setTimeout(() => {
        if (currentIndexRef.current !== capturedIndex) return;
        setInQuizGate(false);
        setGateSelected(null);
      }, 1200);
    }
  }, [gateSelected, gateCorrectIndex, index, learnedSinceLastCheck, words, marks, advanceCard]);

  const selectSpotCheckAnswer = useCallback((idx: number) => {
    if (spotCheckSelected !== null) return;
    const capturedIndex = index;
    setSpotCheckSelected(idx);
    setTimeout(() => {
      if (currentIndexRef.current !== capturedIndex) return;
      setInSpotCheck(false);
      advanceCard();
    }, 700);
  }, [spotCheckSelected, index, advanceCard]);

  const markTooHard = useCallback(async () => {
    if (!current) return;
    // Too Hard earns the same XP/SRS reward as Learned (see grantLearnReward)
    // — the only extra effect is that the word lands in a Hard Words list so
    // students can't game things by mis-marking hard words as Learned. In a
    // class session that list is the CLASS one (so the teacher sees it), not
    // the personal /hard-words.
    if ((sourceClass || sourceClassHW) && classIdParam) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) void addClassHardWord(user.id, classIdParam, current.word);
      });
    } else {
      addHardWord(current.word);
    }
    setSkipped(s => [...s, current]);
    const isNew = await grantLearnReward(current, { sourceClass, sourceClassHW, classIdParam });
    finishWordMark('too-hard', isNew, 0, true);
  }, [current, sourceClass, sourceClassHW, classIdParam, finishWordMark]);

  const dismissSkipTip = useCallback(() => {
    setShowSkipTip(false);
    localStorage.setItem('lexivo_seen_skip_tip', '1');
  }, []);

  const skipWord = useCallback(() => {
    if (!current) return;
    dismissSkipTip();
    setPureSkipped(s => [...s, current]);
    perWordDataRef.current.push({
      word: current.word,
      outcome: 'skipped',
      seconds_to_mark: Math.round((Date.now() - wordStartRef.current) / 1000),
      gate_attempts: 0,
      gate_correct_first: true,
    });
    setMarks(m => { const n = [...m]; n[index] = 'skipped'; return n; });
    if (index + 1 >= words.length) setDone(true);
    else { setIndex(i => i + 1); setMaxReached(m => Math.max(m, index + 1)); }
  }, [current, index, words, dismissSkipTip]);

  const handleStar = () => {
    if (!current) return;
    const w = current.word;
    if ((sourceClass || sourceClassHW) && classIdParam) {
      const nowStarred = !classStarred.has(w);
      setClassStarred(prev => {
        const n = new Set(prev);
        if (nowStarred) n.add(w); else n.delete(w);
        return n;
      });
      setStarredState(nowStarred);
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return;
        void (nowStarred ? addClassStarredWord(user.id, classIdParam, w)
                         : removeClassStarredWord(user.id, classIdParam, w));
      });
    } else {
      setStarredState(toggleStarred(w));
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      switch (e.key) {
        case 's': case 'S': if (current) { current.language ? speakText(current.word, current.language) : speakAccent(current.word, defaultAccent); } break;
        case 'f': case 'F': setFocusMode(!focusMode); break;
        case 'k': case 'K': if (marks[index] == null) skipWord(); break;
        case 'h': case 'H':
          if (!revealed) setShowHint(true);
          else markTooHard();
          break;
        case 'ArrowRight': case 'Enter': case ' ':
          e.preventDefault();
          if (!done) {
            if (!revealed) { setRevealed(true); dismissSkipTip(); }
            else if (!inQuizGate && !inSpotCheck) tryAdvanceCard();
          }
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [current, done, focusMode, revealed, marks, index, tryAdvanceCard, markTooHard, skipWord, dismissSkipTip, inQuizGate, inSpotCheck]);

  // No unit selected → show picker
  if (!collectionName && !hardOnly && !sourceMyWords && !sourceStarred && !sourceClass && !sourceClassHW) return <UnitPicker mode="learn" />;

  if (!collectionsLoaded && !sourceClass && !sourceClassHW) return <LoadingState />;
  if ((sourceClass || sourceClassHW) && !classWordsLoaded && words.length === 0) return <LoadingState />;

  if (words.length === 0) {
    return (
      <div className="p-6 text-center">
        <div className="text-5xl mb-4">📭</div>
        <h2 className="font-bold text-xl mb-2">{t.common.noWordsFound}</h2>
        <Link href="/" className="btn-primary inline-block mt-4">{t.common.goHome}</Link>
      </div>
    );
  }

  if (done) {
    const backUrl = sourceClass
      ? `/classes/${classIdParam}/words`
      : sourceClassHW ? (sp.get('hwId') ? `/classes/${sp.get('classId')}/homework/${sp.get('hwId')}?completed=learn` : '/classes')
      : hardOnly ? '/hard-words'
      : sourceMyWords ? (myCollection ? (myFolder ? `/my-words/${encodeURIComponent(myFolder)}/${encodeURIComponent(myCollection)}` : `/my-words/${encodeURIComponent(myCollection)}`) : '/my-words')
      : collectionName ? `/collections/${encodeURIComponent(collectionName)}`
      : '/';
    return (
      <SessionDone
        sessionCount={sessionCount}
        skipped={skipped}
        pureSkipped={pureSkipped}
        myUnitCompleted={myUnitCompleted}
        backUrl={backUrl}
        collectionName={sourceClassHW || sourceClass ? classNameParam : collectionName}
        dayNumber={sourceClass ? undefined : dayNumber}
        xpEarned={sessionXP}
        streak={getStreak()}
        todayCount={getTodayLearnedCount()}
        onRestart={() => { setIndex(0); setMaxReached(0); setDone(false); setSessionCount(0); setSkipped([]); setPureSkipped([]); setMarks(new Array(words.length).fill(null)); }}
        classHWNextUrl={sourceClassHW && sp.get('hwId') ? `/flashcards?source=class-hw&className=${encodeURIComponent(classNameParam)}&classId=${classIdParam}&hwId=${sp.get('hwId')}&prevCompleted=learn` : undefined}
        myWordsNextUrl={sourceMyWords && myCollection ? `/flashcards?source=my-words&myCollection=${encodeURIComponent(myCollection)}${myFolder ? `&myFolder=${encodeURIComponent(myFolder)}` : ''}` : undefined}
      />
    );
  }

  if (!current) return null;

  if (resumePrompt) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center gap-5 animate-fade-in">
        <div className="text-5xl">📖</div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-[var(--text)]">Resume where you left off?</h2>
          <p className="text-sm text-[var(--text-muted)] max-w-xs leading-relaxed">
            You made it to word <strong>{resumePrompt.savedIndex + 1}</strong> of <strong>{resumePrompt.total}</strong> last time.
          </p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            className="btn-primary"
            onClick={() => {
              const tooHardSet = new Set(resumePrompt.tooHard);
              const skippedSet = new Set(resumePrompt.skipped);
              setSkipped(words.filter(w => tooHardSet.has(w.word)));
              setPureSkipped(words.filter(w => skippedSet.has(w.word)));
              const newMarks: ('learned' | 'skipped' | 'too-hard' | null)[] = new Array(words.length).fill(null);
              words.forEach((w, i) => {
                if (i < resumePrompt.savedIndex) {
                  if (tooHardSet.has(w.word)) newMarks[i] = 'too-hard';
                  else if (skippedSet.has(w.word)) newMarks[i] = 'skipped';
                  else newMarks[i] = 'learned';
                }
              });
              setMarks(newMarks);
              setIndex(resumePrompt.savedIndex);
              setMaxReached(resumePrompt.savedIndex);
              setResumePrompt(null);
            }}
          >
            Resume from word {resumePrompt.savedIndex + 1}
          </button>
          <button
            className="btn-secondary"
            onClick={() => {
              if (collectionName && dayNumber !== undefined) clearLearnProgress(collectionName, dayNumber);
              else if (sourceClass) clearLearnProgress(classNameParam, 0);
              setResumePrompt(null);
            }}
          >
            Start over
          </button>
        </div>
      </div>
    );
  }

  const mark = marks[index] ?? null;
  const isMarked = mark != null;
  const showBack = revealed || isMarked;
  const cardBg = mark === 'learned' ? '#15803d' : mark === 'too-hard' ? '#b91c1c' : mark === 'skipped' ? '#c2410c' : undefined;
  const cardCssVars = cardBg ? { '--text': '#fff', '--text-muted': 'rgba(255,255,255,0.85)', '--primary': '#fff', '--primary-bg': 'rgba(255,255,255,0.2)', '--surface-2': 'rgba(255,255,255,0.12)', '--surface': 'rgba(255,255,255,0.08)', '--border': 'rgba(255,255,255,0.2)' } as React.CSSProperties : {};

  return (
    <div className={`flex flex-col min-h-screen ${focusMode ? 'focus-container' : ''}`}>
      {/* Header */}
      <div className="no-focus flex items-center justify-between p-4 pb-2">
        <button
          onClick={() => {
            if (index > 0 && !done && collectionName && dayNumber !== undefined) {
              saveLearnProgress(collectionName, dayNumber, index);
              saveLearnMarks(collectionName, dayNumber, skipped.map(w => w.word), pureSkipped.map(w => w.word));
            } else if (index > 0 && !done && sourceClass) {
              saveLearnProgress(classNameParam, 0, index);
              saveLearnMarks(classNameParam, 0, skipped.map(w => w.word), pureSkipped.map(w => w.word));
            }
            if (sourceClassHW && sp.get('hwId')) {
              router.push(`/classes/${sp.get('classId')}/homework/${sp.get('hwId')}`);
            } else if (sourceClass && classIdParam) {
              router.push(`/classes/${classIdParam}/words`);
            } else {
              router.back();
            }
          }}
          className="btn-icon text-lg"
          aria-label="Go back"
        >←</button>
        <div className="flex-1 mx-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-[var(--text-muted)] truncate">
              {sourceClass ? classNameParam : (collectionName ? collectionName.split(' ').slice(0, 2).join(' ') : 'All Collections')}
            </span>
            <div className="flex items-center shrink-0 ml-2">
              <button
                onClick={() => { setIndex(i => Math.max(0, i - 1)); setRevealed(false); }}
                disabled={index === 0}
                className="w-6 h-6 flex items-center justify-center text-[var(--primary)] disabled:opacity-30 text-lg font-bold"
                aria-label="Previous card"
              >‹</button>
              <span className="text-xs font-bold text-[var(--primary)] px-1">
                {index + 1} <span className="text-[var(--text-muted)] font-normal">/ {words.length}</span>
              </span>
              <button
                onClick={() => { setIndex(i => Math.min(words.length - 1, i + 1)); setRevealed(false); }}
                disabled={index >= words.length - 1}
                className="w-6 h-6 flex items-center justify-center text-[var(--primary)] disabled:opacity-30 text-lg font-bold"
                aria-label="Next card"
              >›</button>
            </div>
          </div>
          <div className="flex gap-0.5">
            {words.map((_, i) => (
              <div
                key={i}
                className="flex-1 rounded-full transition-colors duration-200"
                style={{
                  height: 4,
                  backgroundColor: i === index
                    ? 'var(--primary)'
                    : marks[i] === 'learned'
                    ? '#22c55e'
                    : marks[i] === 'too-hard'
                    ? '#ef4444'
                    : marks[i] === 'skipped'
                    ? '#f97316'
                    : 'var(--border)',
                }}
              />
            ))}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={handleStar} className="btn-icon text-lg" aria-label={starred ? 'Remove from starred' : 'Add to starred'}>
            {starred ? '⭐' : '☆'}
          </button>
          <button onClick={() => setFocusMode(!focusMode)} className="btn-icon text-base" aria-label={focusMode ? 'Exit focus mode' : 'Enter focus mode'}>
            {focusMode ? '⊠' : '⛶'}
          </button>
        </div>
      </div>

      <div className="flex-1 p-4 flex flex-col gap-4">
        {/* Word card */}
        <TiltCard className="flex-1 animate-slide-up" intensity={5} glare={false}>
        <div
          className={`card h-full transition-all ${!showBack ? 'cursor-pointer hover:border-[var(--primary)]' : ''}`}
          style={{ minHeight: 300, ...(cardBg ? { background: cardBg, borderColor: 'transparent' } : {}), ...cardCssVars }}
          onClick={!showBack ? () => { setRevealed(true); dismissSkipTip(); } : undefined}
        >
          {isMarked && (
            <button
              onClick={e => { e.stopPropagation(); setMarks(m => { const n = [...m]; n[index] = null; return n; }); setRevealed(false); }}
              className="mb-3 px-3 py-1.5 rounded-full text-xs font-bold text-white w-fit hover:opacity-80 active:scale-95 transition-all cursor-pointer"
              style={{ background: 'rgba(255,255,255,0.25)' }}
              title="Click to undo this mark"
            >
              {mark === 'learned' ? '✓ Already marked as Learned' : mark === 'too-hard' ? '😤 Too Hard' : '⏭ Skipped — still counts!'} ✕
            </button>
          )}
          {/* Topic + audio */}
          <div className="flex items-center justify-between mb-3">
            <span className="badge">{current.topic}</span>
            {current.language ? (
              <button
                onClick={e => { e.stopPropagation(); speakText(current.word, current.language!); }}
                className="w-8 h-8 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-base hover:bg-[var(--primary-bg)] transition-colors"
                aria-label="Listen to pronunciation"
              >🔊</button>
            ) : (
              <div className="flex gap-1.5">
                <AccentButton
                  onClick={e => { e.stopPropagation(); speakAccent(current.word, 'us'); }}
                  flag="🇺🇸" label={t.learn.american}
                  active={defaultAccent === 'us'}
                />
                <AccentButton
                  onClick={e => { e.stopPropagation(); speakAccent(current.word, 'uk'); }}
                  flag="🇬🇧" label={t.learn.british}
                  active={defaultAccent === 'uk'}
                />
              </div>
            )}
          </div>

          {/* Word */}
          <h2 className="text-3xl font-bold text-[var(--text)] mb-1">{current.word}</h2>
          <p className="text-[var(--text-muted)] text-sm">
            <span className="italic">{current.partOfSpeech}</span> · {current.pronunciation}
          </p>

          {!showBack ? (
            /* ── Front: tap-to-reveal ── */
            <div className="mt-8 mb-4 flex flex-col items-center gap-3 select-none">
              <div className="text-5xl">🤔</div>
              <p className="text-sm font-medium text-[var(--text-muted)]">{t.learn.doYouKnow}</p>
              <div
                className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold pointer-events-none"
                style={{ background: 'var(--primary-bg)', color: 'var(--primary)' }}
              >
                {t.learn.tapToReveal}
              </div>
            </div>
          ) : (
            /* ── Back: definition + translation + examples ── */
            <div className="mt-4 space-y-3 animate-fade-in">
              <p className="text-base font-semibold text-[var(--text)] leading-relaxed">{current.definition}</p>

              <div className="bg-[var(--primary-bg)] rounded-xl p-3">
                <p className="text-xs font-semibold text-[var(--primary)] mb-1">🇺🇿 O'zbek tarjimasi</p>
                <p className="text-sm text-[var(--primary)]">{current.translation}</p>
              </div>

              {current.definitionUz && (
                <div>
                  <button
                    onClick={() => setShowUzDefinition(v => !v)}
                    className="text-xs text-[var(--primary)] font-medium hover:underline"
                  >
                    {showUzDefinition ? "Yopish" : "O'zbekcha tushuntirish"}
                  </button>
                  {showUzDefinition && (
                    <p className="text-sm text-[var(--text-muted)] mt-1 animate-fade-in">{current.definitionUz}</p>
                  )}
                </div>
              )}

              <ExampleCard
                num={1}
                example={current.example1}
                translation={current.example1Translation}
                showTranslation={showEx1Translation}
                onToggle={() => setShowEx1Translation(v => !v)}
                language={current.language}
              />
              {current.example2 && (
                <ExampleCard
                  num={2}
                  example={current.example2}
                  translation={current.example2Translation}
                  showTranslation={showEx2Translation}
                  onToggle={() => setShowEx2Translation(v => !v)}
                  language={current.language}
                />
              )}
              {current.example3 && (
                <ExampleCard
                  num={3}
                  example={current.example3}
                  translation={current.example3Translation}
                  showTranslation={showEx3Translation}
                  onToggle={() => setShowEx3Translation(v => !v)}
                  language={current.language}
                />
              )}

              {current.extraExamples && current.extraExamples.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowMoreExamples(v => !v)}
                    className="text-sm text-[var(--primary)] font-medium hover:underline flex items-center gap-1"
                  >
                    {showMoreExamples ? '− Hide examples' : `+ More examples (${current.extraExamples.length})`}
                  </button>
                  {showMoreExamples && (
                    <div className="mt-2 space-y-2 animate-fade-in">
                      {current.extraExamples.map((ex, i) => (
                        <ExtraExampleCard
                          key={i}
                          index={i}
                          example={ex}
                          translation={current.extraExampleTranslations?.[i]}
                          language={current.language}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        </TiltCard>

        {/* Hint — only before reveal on unvisited cards */}
        {!showBack && !isMarked && (
          <div className="no-focus">
            <div className="text-center">
              {!showHint ? (
                <button
                  onClick={() => setShowHint(true)}
                  className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] underline"
                >
                  {t.learn.needHint}
                </button>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 animate-fade-in text-left">
                  <p className="text-xs font-semibold text-amber-600 mb-1">{t.learn.hint}</p>
                  <p className="text-sm text-amber-900">{current.definition.split(' ').slice(0, 8).join(' ')}…</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action buttons — normal state only; quiz states handled by full-screen overlay */}
        {!isMarked && !inSpotCheck && !inQuizGate && (
          <div className="no-focus space-y-2">
            {showBack && (
              <div className="flex gap-3 animate-fade-in">
                <button
                  onClick={markTooHard}
                  className="flex-1 py-3.5 rounded-xl border-2 border-[var(--danger)] text-[var(--danger)] font-semibold text-sm hover:bg-red-50 transition-colors press-3d"
                >
                  {t.learn.tooHard} <kbd className="ml-1 opacity-60 text-xs">H</kbd>
                </button>
                <button
                  onClick={tryAdvanceCard}
                  disabled={revealCountdown > 0}
                  className="flex-[2] btn-primary py-3.5 text-center press-3d disabled:opacity-60"
                >
                  {revealCountdown > 0 ? `⏳ ${revealCountdown}s` : <>{t.learn.gotIt} <kbd className="ml-1 opacity-60 text-xs">Space</kbd></>}
                </button>
              </div>
            )}
            <button
              onClick={skipWord}
              className="w-full py-3 rounded-xl border-2 border-[var(--border)] text-[var(--text-muted)] font-semibold text-sm hover:border-orange-300 hover:text-orange-500 transition-colors press-3d"
            >
              {t.common.skip} <kbd className="ml-1 opacity-60 text-xs">K</kbd>
            </button>
            {showSkipTip && (
              <div className="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2.5 animate-fade-in">
                <span className="text-base shrink-0 mt-0.5">⏭️</span>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-orange-700">{t.learn.skipTipTitle}</p>
                  <p className="text-xs text-orange-600 mt-0.5">{t.learn.skipTipBody}</p>
                </div>
                <button onClick={dismissSkipTip} className="text-orange-400 hover:text-orange-600 text-sm font-bold shrink-0 mt-0.5" aria-label="Dismiss tip">✕</button>
              </div>
            )}
          </div>
        )}

        <div className="no-focus text-center text-xs text-[var(--text-muted)]">
          {t.learn.remaining(words.length - index - 1)} · <kbd>S</kbd> {t.learn.listenShort} · <kbd>H</kbd> {revealed ? t.learn.tooHardShort : t.learn.hintShort}{!revealed ? <> · <kbd>K</kbd> {t.learn.skipShort}</> : null}
        </div>
      </div>

      {/* Per-word "+N XP" flash */}
      {xpFlash && (
        <div className="no-focus fixed left-0 right-0 bottom-28 z-40 flex justify-center pointer-events-none">
          <span
            key={xpFlash.id}
            className="animate-xp-float inline-block rounded-full bg-[#22c55e] text-white font-bold text-sm px-3.5 py-1.5 shadow-lg"
          >
            +{displayXP(xpFlash.amount)} XP
          </span>
        </div>
      )}

      {/* Full-screen quiz overlay */}
      {(inSpotCheck || inQuizGate) && (() => {
        const isSpot = inSpotCheck;
        const word = isSpot ? (spotCheckWord?.word ?? '') : current.word;
        const options = isSpot ? spotCheckOptions : gateOptions;
        const correctIndex = isSpot ? spotCheckCorrectIndex : gateCorrectIndex;
        const selected = isSpot ? spotCheckSelected : gateSelected;
        return (
          <div className="fixed inset-0 z-50 flex flex-col animate-fade-in" style={{ backgroundColor: 'var(--surface)' }}>
            <div className="flex flex-col flex-1 px-5 pt-12 pb-8 max-w-lg mx-auto w-full">
              <p className="text-xs font-extrabold tracking-widest uppercase mb-6" style={{ color: 'var(--primary)' }}>
                {isSpot ? '🔍  Spot Check' : '🎯  Quick Check'}
              </p>

              {/* Question box */}
              <div className="w-full rounded-2xl p-5 mb-6" style={{ background: 'var(--surface-2)', border: '2px solid var(--border)' }}>
                <p className="text-2xl font-black" style={{ color: 'var(--text)' }}>{word}</p>
                <p className="text-sm mt-1.5" style={{ color: 'var(--text-muted)' }}>
                  {isSpot ? 'What does this word mean?' : 'What is the translation?'}
                </p>
              </div>

              {/* 2×2 answer grid */}
              <div className="grid grid-cols-2 gap-3">
                {options.map((opt, i) => {
                  const isCorrect = i === correctIndex;
                  const showResult = selected !== null;
                  let bg = 'var(--surface-2)';
                  let border = 'var(--border)';
                  let color = 'var(--text)';
                  if (showResult && isCorrect) { bg = '#22c55e'; border = '#22c55e'; color = '#fff'; }
                  else if (showResult && selected === i) { bg = '#ef4444'; border = '#ef4444'; color = '#fff'; }
                  return (
                    <button
                      key={i}
                      onClick={() => isSpot ? selectSpotCheckAnswer(i) : selectGateAnswer(i)}
                      disabled={selected !== null}
                      className="py-5 px-4 rounded-2xl text-sm font-semibold text-left transition-colors press-3d"
                      style={{ background: bg, border: `2px solid ${border}`, color }}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default function LearnPage() {
  return (
    <Suspense>
      <LearnInner />
    </Suspense>
  );
}

function ExampleCard({
  num, example, translation, showTranslation, onToggle, language,
}: {
  num: number; example: string; translation?: string;
  showTranslation: boolean; onToggle: () => void; language?: string;
}) {
  return (
    <div
      className="rounded-xl overflow-hidden border border-[var(--border)] cursor-pointer select-none"
      onClick={onToggle}
    >
      <div className="bg-[var(--surface-2)] px-3 pt-3 pb-2">
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="text-xs font-semibold text-[var(--primary)] bg-[var(--primary-bg)] px-2 py-0.5 rounded-full">
            Example {num} · Medium
          </span>
          <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
            {language ? (
              <button
                onClick={() => speakText(example, language)}
                className="w-6 h-6 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-xs hover:bg-[var(--primary-bg)] transition-colors"
                aria-label="Listen to pronunciation"
              >🔊</button>
            ) : (
              <>
                <AccentButton onClick={() => speakAccent(example, 'us')} flag="🇺🇸" label="American" size="sm" />
                <AccentButton onClick={() => speakAccent(example, 'uk')} flag="🇬🇧" label="British" size="sm" />
              </>
            )}
          </div>
        </div>
        <p className="text-sm italic text-[var(--text)]">&ldquo;{example}&rdquo;</p>
      </div>
      {translation && (
        <div className="px-3 py-2 bg-[var(--surface)]">
          {showTranslation
            ? <p className="text-xs text-[var(--primary)] animate-fade-in">{translation}</p>
            : <p className="text-xs text-[var(--text-muted)] text-center">Tap to see translation</p>}
        </div>
      )}
    </div>
  );
}

function ExtraExampleCard({
  index, example, translation, language,
}: {
  index: number; example: string; translation?: string; language?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div
      className="rounded-xl overflow-hidden border border-[var(--border)] cursor-pointer select-none"
      onClick={() => setShow(v => !v)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShow(v => !v); } }}
      role="button"
      tabIndex={0}
      aria-expanded={show}
    >
      <div className="bg-[var(--surface-2)] px-3 pt-2.5 pb-2">
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="text-xs text-[var(--text-muted)]">Extra {index + 1}</span>
          {language && (
            <button
              onClick={e => { e.stopPropagation(); speakText(example, language); }}
              className="w-5 h-5 rounded-full flex items-center justify-center text-xs hover:bg-[var(--primary-bg)] transition-colors shrink-0"
              aria-label="Listen to pronunciation"
            >🔊</button>
          )}
        </div>
        <p className="text-sm italic text-[var(--text)]">&ldquo;{example}&rdquo;</p>
      </div>
      {translation && (
        <div className="px-3 py-2 bg-[var(--surface)]">
          {show
            ? <p className="text-xs text-[var(--primary)] animate-fade-in">{translation}</p>
            : <p className="text-xs text-[var(--text-muted)] text-center">Tap to see translation</p>}
        </div>
      )}
    </div>
  );
}

function AccentButton({
  onClick, flag, label, size = 'md', active = false,
}: {
  onClick: (e: React.MouseEvent) => void;
  flag: string;
  label: string;
  size?: 'sm' | 'md';
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`rounded-full flex items-center justify-center transition-colors ${
        size === 'sm' ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-base'
      } ${active ? 'bg-[var(--primary)] text-white' : 'bg-[var(--surface-2)] hover:bg-[var(--primary-bg)]'}`}
    >
      {flag}
    </button>
  );
}

function LoadingState() {
  const t = useTranslation();
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <SectionLoader />
        <p className="text-[var(--text-muted)]">{t.learn.loading}</p>
      </div>
    </div>
  );
}

function SessionDone({
  sessionCount, skipped, pureSkipped, myUnitCompleted, backUrl, collectionName, dayNumber, xpEarned, streak, todayCount, onRestart, classHWNextUrl, myWordsNextUrl,
}: {
  sessionCount: number;
  skipped: StudyWord[];
  pureSkipped: StudyWord[];
  myUnitCompleted?: boolean;
  backUrl: string;
  collectionName?: string;
  dayNumber?: number;
  xpEarned: number;
  streak: number;
  todayCount: number;
  onRestart: () => void;
  classHWNextUrl?: string;
  myWordsNextUrl?: string;
}) {
  const t = useTranslation();
  const hardStudyUrl = collectionName
    ? `/learn?collection=${encodeURIComponent(collectionName)}&hard=true`
    : '/learn?hard=true';

  return (
    <div className="p-6 animate-fade-in flex flex-col items-center min-h-screen">
      {myUnitCompleted && (
        <div className="w-full rounded-2xl px-4 py-3 mb-4 text-center font-bold animate-pop" style={{ background: 'rgba(34,197,94,0.12)', color: 'var(--success)', border: '1.5px solid var(--success)' }}>
          🏆 Unit Complete!
        </div>
      )}
      {/* Hero */}
      <div className="flex flex-col items-center text-center pt-10 pb-6">
        <div className="text-6xl mb-3 animate-pop">🎉</div>
        <h2 className="text-2xl font-bold text-[var(--text)]">{t.learn.sessionComplete}</h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          {collectionName ?? 'All Collections'}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 w-full mb-4">
        <StatTile icon="📚" value={sessionCount} label={t.learn.wordsLearned} color="var(--primary)" />
        {classHWNextUrl ? (
          <StatTile icon="🎓" value="Class XP" label="awarded by class" color="var(--warning)" />
        ) : (
          <StatTile icon="⚡" value={`+${displayXP(xpEarned)}`} label={t.learn.xpEarned} color="var(--warning)" />
        )}
        {!classHWNextUrl && <StatTile icon="🔥" value={streak} label={t.learn.dayStreak} color="#FF6B35" />}
        <StatTile icon="😓" value={skipped.length} label={t.learn.hardWords} color={skipped.length > 0 ? 'var(--danger)' : 'var(--success)'} />
        {pureSkipped.length > 0 && (
          <div className="col-span-2">
            <StatTile icon="⏭️" value={pureSkipped.length} label={t.learn.skipped} color="#F97316" />
          </div>
        )}
      </div>

      {/* Today's progress nudge */}
      {!classHWNextUrl && <div className="w-full card mb-4 flex items-center gap-3">
        <span className="text-2xl">📅</span>
        <div>
          <p className="text-sm font-semibold text-[var(--text)]">{t.learn.wordsToday(todayCount)}</p>
          <p className="text-xs text-[var(--text-muted)]">{t.learn.keepGoing}</p>
        </div>
      </div>}

      {/* Next step: Flashcards (regular) */}
      {collectionName && dayNumber !== undefined && (
        <Link
          href={`/flashcards?collection=${encodeURIComponent(collectionName)}&day=${dayNumber}`}
          className="w-full flex items-center justify-between px-5 py-4 rounded-2xl text-white mb-1"
          style={{ background: 'linear-gradient(135deg, #FF6B35, #FF8C42)' }}
        >
          <div>
            <div className="font-bold text-sm">{t.learn.practiceFlashcards}</div>
            <div className="text-xs opacity-80 mt-0.5">{t.learn.reinforceSub}</div>
          </div>
          <span className="text-lg">→</span>
        </Link>
      )}

      {/* Next step: Flashcards (My Words) */}
      {myWordsNextUrl && (
        <Link
          href={myWordsNextUrl}
          className="w-full flex items-center justify-between px-5 py-4 rounded-2xl text-white mb-1"
          style={{ background: 'linear-gradient(135deg, #FF6B35, #FF8C42)' }}
        >
          <div>
            <div className="font-bold text-sm">{t.learn.practiceFlashcards}</div>
            <div className="text-xs opacity-80 mt-0.5">{t.learn.reinforceSub}</div>
          </div>
          <span className="text-lg">→</span>
        </Link>
      )}

      {/* Next step: Cards (class homework) */}
      {classHWNextUrl && (
        <Link
          href={classHWNextUrl}
          className="w-full flex items-center justify-between px-5 py-4 rounded-2xl text-white mb-1"
          style={{ background: 'linear-gradient(135deg, #ea580c, #f97316)' }}
        >
          <div>
            <div className="font-bold text-sm">Next: Practice with Cards</div>
            <div className="text-xs opacity-80 mt-0.5">Reinforce what you just learned</div>
          </div>
          <span className="text-lg">→</span>
        </Link>
      )}

      {/* Hard words list + shortcut */}
      {skipped.length > 0 && (
        <div className="w-full card mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-sm text-[var(--danger)]">{t.learn.markedTooHard}</p>
            <Link
              href={hardStudyUrl}
              className="text-xs font-semibold px-3 py-1 rounded-full bg-[var(--danger)] text-white"
            >
              {t.learn.studyNow}
            </Link>
          </div>
          <div className="space-y-1">
            {skipped.map(w => (
              <div key={w.word} className="text-sm py-1.5 border-b border-[var(--border)] last:border-0 flex justify-between gap-4">
                <span className="font-medium text-[var(--text)]">{w.word}</span>
                <span className="text-[var(--text-muted)] truncate">{w.translation}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 w-full mt-auto pt-4">
        <button onClick={onRestart} className="btn-secondary flex-1">{t.common.again}</button>
        <Link href={backUrl} className="btn-primary flex-1 text-center">{t.common.back}</Link>
      </div>
    </div>
  );
}

function StatTile({ icon, value, label, color }: { icon: string; value: number | string; label: string; color: string }) {
  return (
    <div className="card flex flex-col items-center py-4 gap-1">
      <span className="text-2xl">{icon}</span>
      <span className="text-2xl font-bold" style={{ color }}>{value}</span>
      <span className="text-xs text-[var(--text-muted)]">{label}</span>
    </div>
  );
}

