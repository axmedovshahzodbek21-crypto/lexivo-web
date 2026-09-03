'use client';
import { PageLoader, SectionLoader } from '@/components/Loader';
import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { speak, speakText } from '@/lib/speech';
import { recordStudySession, markQuizComplete, unlockAchievement, getStarredWords, getCustomListWords, getSettings, getUnitProgress, getImportedWords, getImportedWordsByCollection, importedWordExampleFields, getClassHWTemp, recordQuizSession, addXP, hasQuizXPAwarded, markQuizXPAwarded, hasQuizPerfectXPAwarded, markQuizPerfectXPAwarded, hasMyWordsXPAwarded, markMyWordsXPAwarded, getMyActivityPendingNewWords, markMyQuizComplete, displayXP } from '@/lib/storage';
import { pushLists, pushStats } from '@/lib/sync';
import { fireConfetti } from '@/lib/confetti';
import { checkAchievements } from '@/lib/gamification';
import { supabase } from '@/lib/supabase';
import { getClassWordsFull, addClassHardWord } from '@/lib/class-srs';
import { recordClassXP } from '@/lib/class-xp';
import { shuffleArray } from '@/lib/shuffleArray';
import type { WordItem, WordCollection, QuizType } from '@/lib/types';
import Link from 'next/link';
import UnitPicker from '@/components/UnitPicker';
import TiltCard from '@/components/TiltCard';
import { useTranslation } from '@/lib/useTranslation';

interface QuizWord extends WordItem {
  collectionName: string;
  topic: string;
  dayNumber: number;
}

interface QuizQuestion {
  word: QuizWord;
  type: QuizType;
  prompt: string;
  correct: string;
  options: string[];
}

// Picks up to 3 distinct wrong answers from `pool` (deduped, excluding the
// correct answer) and returns the shuffled 4-option set. Was copy-pasted
// identically 4 times across this file's four separate question-builders
// (the module-level buildQuiz, plus the class/class-homework/my-words
// inline builders below) — extracted once here.
function buildDistractorOptions(correct: string, pool: string[]): string[] {
  const wrongs = shuffleArray([...new Set(pool)].filter(w => w !== correct)).slice(0, 3);
  return shuffleArray([correct, ...wrongs]);
}

function buildQuiz(
  collections: WordCollection[],
  collectionName?: string,
  dayNumber?: number,
  starredOnly?: boolean,
  listId?: string,
  quizDirection: 'word-to-uz' | 'uz-to-word' = 'word-to-uz',
): QuizQuestion[] {
  let allWords: QuizWord[];
  if (listId) {
    allWords = getCustomListWords(listId, collections);
  } else {
    const starredSet = starredOnly ? new Set(getStarredWords()) : null;
    allWords = [];
    for (const col of collections) {
      if (collectionName && col.name !== collectionName) continue;
      for (const day of col.days) {
        if (dayNumber !== undefined && day.dayNumber !== dayNumber) continue;
        for (const word of day.words) {
          if (starredSet && !starredSet.has(word.word)) continue;
          allWords.push({ ...word, collectionName: col.name, topic: day.topic, dayNumber: day.dayNumber });
        }
      }
    }
  }

  const words = (dayNumber !== undefined || starredOnly || listId) ? shuffleArray(allWords) : shuffleArray(allWords).slice(0, 10);
  const types: QuizType[] = quizDirection === 'uz-to-word'
    ? ['translation_to_word', 'word_to_translation', 'definition_to_word']
    : ['word_to_translation', 'translation_to_word', 'definition_to_word'];

  return words.map((word, i): QuizQuestion => {
    const type = types[i % 3];
    let prompt = '';
    let correct = '';

    if (type === 'word_to_translation') {
      prompt = word.word;
      correct = word.translation;
    } else if (type === 'translation_to_word') {
      prompt = word.translation;
      correct = word.word;
    } else {
      prompt = word.definition;
      correct = word.word;
    }

    // Pick 3 wrong answers from pool
    const pool = allWords
      .filter(w => w.word !== word.word)
      .map(w => type === 'word_to_translation' ? w.translation : w.word);
    const options = buildDistractorOptions(correct, pool);
    return { word, type, prompt, correct, options };
  });
}

type QuizState = 'idle' | 'answered';

function QuizInner() {
  const router = useRouter();
  // Reactive — a one-time window.location.search read here previously meant
  // picking a different unit from the in-page picker (a client-side
  // navigation, not a full reload) didn't actually reload the quiz, since
  // the effect that captured search params only ever ran once on mount.
  const sp = useSearchParams();
  const collectionName = sp.get('collection') ?? undefined;
  const dayParam = sp.get('day');
  const dayNumber = dayParam ? parseInt(dayParam) : undefined;
  const starredOnly = sp.get('starred') === 'true';
  const listId      = sp.get('list') ?? undefined;
  const sourceMyWords  = sp.get('source') === 'my-words';
  const sourceClassHW  = sp.get('source') === 'class-hw';
  const sourceClass    = sp.get('source') === 'class';
  const classId        = sp.get('classId') ?? undefined;
  const classNameParam = sp.get('className') ?? 'Class';
  const myCollection = sp.get('myCollection') ?? undefined;
  const myFolder     = sp.get('myFolder') ?? undefined;
  const onlyNew = sp.get('onlyNew') === '1';
  const { collections, collectionsLoaded, pushAchievement, setPendingLevelUp } = useAppStore();

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [state, setState] = useState<QuizState>('idle');
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState(false);
  const [myUnitCompleted, setMyUnitCompleted] = useState(false);
  const [sessionXP, setSessionXP] = useState(0);
  const [wrongQuestions, setWrongQuestions] = useState<QuizQuestion[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const selecting = useRef(false);
  const t = useTranslation();
  const [quizDirection, setQuizDirection] = useState<'word-to-uz' | 'uz-to-word'>('word-to-uz');

  useEffect(() => {
    setQuizDirection(getSettings().quizDirection);
  }, []);

  useEffect(() => {
    if (!sourceClass) return;
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, [sourceClass]);

  // Gate: must complete Learn → Cards before Quiz (for unit sessions)
  const [gateInfo, setGateInfo] = useState<{ url: string; missing: string } | null>(null);
  useEffect(() => {
    if (sourceClass) return; // class sessions have no gate
    if (collectionName && dayNumber !== undefined) {
      const p = getUnitProgress(collectionName, dayNumber);
      if (!p.learnDone) {
        setGateInfo({ url: `/learn?collection=${encodeURIComponent(collectionName)}&day=${dayNumber}`, missing: 'Learn' });
      } else if (!p.flashcardDone) {
        setGateInfo({ url: `/flashcards?collection=${encodeURIComponent(collectionName)}&day=${dayNumber}`, missing: 'Flashcards' });
      }
    }
  }, [collectionName, dayNumber, sourceClass]);

  // Class quiz: fetch words from Supabase and build questions
  useEffect(() => {
    if (!sourceClass || !classId) return;
    (async () => {
      const raw = await getClassWordsFull(classId);
      const allWords: QuizWord[] = raw.map(w => ({
        word: w.word, partOfSpeech: '', pronunciation: '',
        translation: w.translation, definition: w.definition ?? '',
        example1: w.example1 ?? '', example1Situation: '', example1Translation: w.example1_translation ?? '',
        example2: w.example2 ?? '', example2Situation: '', example2Translation: w.example2_translation ?? '',
        example3: '', example3Translation: '', example3Situation: '',
        collectionName: classId, topic: classNameParam, dayNumber: 0,
      }));
      const words = shuffleArray(allWords);
      const types: ['word_to_translation', 'translation_to_word', 'definition_to_word'] =
        ['word_to_translation', 'translation_to_word', 'definition_to_word'];
      const qs: QuizQuestion[] = words.map((word, i): QuizQuestion => {
        const type = types[i % 3];
        let prompt = '';
        let correct = '';
        if (type === 'word_to_translation') { prompt = word.word; correct = word.translation; }
        else if (type === 'translation_to_word') { prompt = word.translation; correct = word.word; }
        else { prompt = word.definition || word.word; correct = word.word; }
        const pool = allWords.filter(w => w.word !== word.word).map(w => type === 'word_to_translation' ? w.translation : w.word);
        return { word, type, prompt, correct, options: buildDistractorOptions(correct, pool) };
      });
      setQuestions(qs);
    })();
  }, [sourceClass, classId, classNameParam]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (sourceClass) return; // handled by separate class useEffect
    if (sourceClassHW) {
      const hw = getClassHWTemp();
      const allWords: QuizWord[] = hw.map(w => ({
        word: w.word, partOfSpeech: w.partOfSpeech ?? '', pronunciation: w.pronunciation ?? '',
        translation: w.translation, definition: w.definition, definitionUz: w.definitionUz ?? '',
        example1: w.example1, example1Situation: '', example1Translation: w.example1Translation,
        example2: w.example2, example2Situation: '', example2Translation: w.example2Translation,
        example3: w.example3 ?? '', example3Translation: w.example3Translation ?? '', example3Situation: '',
        extraExamples: w.extraExamples ?? [], extraExampleTranslations: w.extraExampleTranslations ?? [],
        collectionName: 'class-hw', topic: w.className, dayNumber: 0,
      }));
      const words = shuffleArray(allWords);
      const types: QuizType[] = ['word_to_translation', 'translation_to_word', 'definition_to_word'];
      const qs: QuizQuestion[] = words.map((word, i): QuizQuestion => {
        const type = types[i % 3];
        let prompt = '';
        let correct = '';
        if (type === 'word_to_translation') { prompt = word.word; correct = word.translation; }
        else if (type === 'translation_to_word') { prompt = word.translation; correct = word.word; }
        else { prompt = word.definition || word.word; correct = word.word; }
        const pool = allWords.filter(w => w.word !== word.word).map(w => type === 'word_to_translation' ? w.translation : w.word);
        const options = buildDistractorOptions(correct, pool);
        return { word, type, prompt, correct, options };
      });
      setQuestions(qs);
      return;
    }
    if (sourceMyWords) {
      let imported = myCollection ? getImportedWordsByCollection(myCollection, myFolder) : getImportedWords();
      if (onlyNew && myCollection) {
        const pending = new Set(getMyActivityPendingNewWords(myFolder, myCollection, 'quiz', imported.map(w => w.word)));
        imported = imported.filter(w => pending.has(w.word));
      }
      const allWords: QuizWord[] = imported.map(w => ({
        word: w.word, partOfSpeech: '', pronunciation: '',
        translation: w.translation, definition: w.definition,
        ...importedWordExampleFields(w),
        language: w.language,
        collectionName: 'my-words', topic: myCollection ?? 'My Words', dayNumber: 0,
      }));
      const words = shuffleArray(allWords);
      const types: QuizType[] = ['word_to_translation', 'translation_to_word', 'definition_to_word'];
      const qs: QuizQuestion[] = words.map((word, i): QuizQuestion => {
        const type = types[i % 3];
        let prompt = '';
        let correct = '';
        if (type === 'word_to_translation') { prompt = word.word; correct = word.translation; }
        else if (type === 'translation_to_word') { prompt = word.translation; correct = word.word; }
        else { prompt = word.definition || word.word; correct = word.word; }
        const pool = allWords.filter(w => w.word !== word.word).map(w => type === 'word_to_translation' ? w.translation : w.word);
        const options = buildDistractorOptions(correct, pool);
        return { word, type, prompt, correct, options };
      });
      setQuestions(qs);
      return;
    }
    if (collectionsLoaded && collections.length > 0) {
      setQuestions(buildQuiz(collections, collectionName, dayNumber, starredOnly, listId, quizDirection));
    }
  }, [collectionsLoaded, collections, collectionName, dayNumber, starredOnly, listId, quizDirection, sourceMyWords, sourceClassHW, myCollection, myFolder, onlyNew]);

  const current = questions[index];

  const handleSelect = useCallback((option: string) => {
    if (state === 'answered' || selecting.current) return;
    selecting.current = true;
    setTimeout(() => { selecting.current = false; }, 100);
    setSelected(option);
    setState('answered');
    if (option === current?.correct) {
      setCorrect(c => c + 1);
    } else {
      if (current) {
        setWrongQuestions(prev => [...prev, current]);
        if (sourceClass && classId && userId) {
          addClassHardWord(userId, classId, current.word.word);
        }
      }
    }
    // Class work is its own world — it must not keep the personal Lexivo
    // study streak alive (the class has its own study-day streak).
    if (!sourceClass && !sourceClassHW) recordStudySession();
  }, [state, current, sourceClass, sourceClassHW, classId, userId]);

  const next = useCallback(() => {
    if (index + 1 >= questions.length) {
      // `correct` already reflects the just-answered last question —
      // handleSelect() increments it synchronously and triggers a re-render
      // before "Next" is even clickable (state must be 'answered' first),
      // so by the time next() runs here it's already up to date. Adding
      // (selected === current?.correct ? 1 : 0) on top double-counted the
      // final answer, letting a user who missed an earlier question still
      // trigger the "perfect score" achievement/XP if they got the last
      // question right.
      const finalCorrect = correct;
      const isPerfect = finalCorrect === questions.length;
      if (!sourceClassHW && !sourceClass) {
        if (isPerfect) unlockAchievement('quiz_perfect', 100); // 10 XP
        unlockAchievement('quiz_first', 30); // 3 XP
        if (collectionName) {
          const qDayNumber = dayNumber ?? questions[0]?.word.dayNumber ?? 1;
          const base = questions.length * 5;
          if (!hasQuizXPAwarded(collectionName, qDayNumber)) {
            const result = addXP(base, 'Quiz', `Unit ${qDayNumber} · ${collectionName}`);
            markQuizXPAwarded(collectionName, qDayNumber);
            setSessionXP(base);
            if (result.leveledUp) setPendingLevelUp({ level: result.newLevel, xp: result.newXp });
          }
          // +25% bonus for a flawless run, granted right at completion, once
          // per unit (own gate so it can still land on a later perfect run).
          if (isPerfect && !hasQuizPerfectXPAwarded(collectionName, qDayNumber)) {
            const bonus = Math.round(base * 0.25);
            const r = addXP(bonus, 'Quiz (perfect)', `Unit ${qDayNumber} · ${collectionName}`);
            markQuizPerfectXPAwarded(collectionName, qDayNumber);
            setSessionXP(prev => prev + bonus);
            if (r.leveledUp) setPendingLevelUp({ level: r.newLevel, xp: r.newXp });
          }
          markQuizComplete(collectionName, qDayNumber);
          const p = getUnitProgress(collectionName, qDayNumber);
          if (p.learnDone && p.flashcardDone && p.quizDone) fireConfetti();
        } else if (sourceMyWords && myCollection) {
          if (!hasMyWordsXPAwarded('quiz', myFolder, myCollection)) {
            const xpAmount = questions.length * 5;
            const result = addXP(xpAmount, 'Quiz', `${myCollection}`);
            markMyWordsXPAwarded('quiz', myFolder, myCollection);
            setSessionXP(xpAmount);
            if (result.leveledUp) setPendingLevelUp({ level: result.newLevel, xp: result.newXp });
          }
          if (markMyQuizComplete(myFolder, myCollection)) { setMyUnitCompleted(true); fireConfetti(); }
        }
        recordQuizSession();
        const newAchievements = checkAchievements();
        newAchievements.forEach(pushAchievement);
      }
      // Class sessions touch nothing in the personal Lexivo store — no sync.
      if (!sourceClass && !sourceClassHW) { pushLists(); pushStats(); }
      if (sourceClass && classId) {
        // Class practice XP: every completed session (no per-day gate), and
        // isolated to the class leaderboard via recordClassXP only — it must
        // NOT touch the personal Lexivo pool (level / global leaderboard).
        // Matches the Flutter app and lib/class-xp.ts's isolation contract.
        // setSessionXP just drives this class session's "+N XP" summary.
        const base = questions.length * 5;
        // +25% for a flawless run, every perfect session (no per-session gate).
        const xpAmount = base + (isPerfect ? Math.round(base * 0.25) : 0);
        const reason = isPerfect ? 'Quiz (perfect)' : 'Quiz';
        setSessionXP(xpAmount);
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (user) void recordClassXP(user.id, classId, xpAmount, reason);
        });
      }
      if (sourceClassHW && sp.get('hwId')) {
        // Record completion the moment the session actually finishes, not
        // gated behind the "Back" link's ?completed= query param — that path
        // was skipped entirely by browser-back, closing the tab, or Retry,
        // silently losing the student's progress and XP.
        void supabase.rpc('record_class_homework_progress', {
          p_homework_id: sp.get('hwId'), p_mode: 'quiz', p_client_word_count: questions.length,
        });
      }
      setDone(true);
    } else {
      setIndex(i => i + 1);
      setSelected(null);
      setState('idle');
    }
  }, [index, questions, correct, selected, current, collectionName, sourceClassHW, sourceClass, classId, classNameParam, pushAchievement, setPendingLevelUp, sourceMyWords, myCollection, myFolder, sp]);

  // Keyboard shortcuts: 1-4 for options
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!current) return;
      if (state === 'idle') {
        const n = parseInt(e.key);
        if (n >= 1 && n <= current.options.length) {
          handleSelect(current.options[n - 1]);
        }
      }
      if (state === 'answered' && (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        next();
      }
      if (e.key === 's' || e.key === 'S') { current.word.language ? speakText(current.word.word, current.word.language) : speak(current.word.word); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // handleSelect/next were previously omitted here — this effect only
    // re-registered the listener when current/state changed, so it could
    // keep calling a stale handleSelect closure built while userId was
    // still null (auth resolves asynchronously). An answer given via
    // keyboard before that resolved silently skipped addClassHardWord's
    // class-mode tracking, even though the *next* click-driven answer
    // (using the current render's fresh handleSelect) would have worked.
  }, [current, state, handleSelect, next]);

  if (!collectionName && !starredOnly && !listId && !sourceMyWords && !sourceClassHW && !sourceClass) return <UnitPicker mode="quiz" />;

  if (gateInfo) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center gap-5 animate-fade-in">
        <div className="text-5xl">🔒</div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-[var(--text)]">Complete {gateInfo.missing} first</h2>
          <p className="text-sm text-[var(--text-muted)] max-w-xs leading-relaxed">
            You need to finish <strong>{gateInfo.missing}</strong> for this unit before you can take the Quiz. The order is: Learn → Flashcards → Quiz.
          </p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Link href={gateInfo.url} className="btn-primary text-center">Go to {gateInfo.missing} →</Link>
          <button onClick={() => router.back()} className="btn-secondary">Go back</button>
        </div>
      </div>
    );
  }

  if (!collectionsLoaded) return <Loading />;
  if (questions.length === 0) return (
    <div className="p-6 text-center">
      <div className="text-5xl mb-4">📭</div>
      <h2 className="font-bold text-xl mb-2">{t.common.noWordsFound}</h2>
      <Link href="/" className="btn-primary inline-block mt-4">{t.common.goHome}</Link>
    </div>
  );

  if (done) {
    const score = Math.round((correct / questions.length) * 100);
    const backUrl = starredOnly ? '/starred' : sourceClass ? `/classes/${classId}/words` : sourceClassHW ? (sp.get('hwId') ? `/classes/${sp.get('classId')}/homework/${sp.get('hwId')}?completed=quiz` : '/classes') : sourceMyWords ? (myCollection ? (myFolder ? `/my-words/${encodeURIComponent(myFolder)}/${encodeURIComponent(myCollection)}` : `/my-words/${encodeURIComponent(myCollection)}`) : '/my-words') : collectionName ? `/collections/${encodeURIComponent(collectionName)}` : '/';
    return (
      <div className="p-6 text-center flex flex-col items-center justify-center min-h-screen animate-fade-in">
        {myUnitCompleted && (
          <div className="w-full rounded-2xl px-4 py-3 mb-4 text-center font-bold animate-pop" style={{ background: 'rgba(34,197,94,0.12)', color: 'var(--success)', border: '1.5px solid var(--success)' }}>
            🏆 Unit Complete!
          </div>
        )}
        <div className="text-6xl mb-4">{score === 100 ? '🏆' : score >= 80 ? '🎉' : score >= 50 ? '👍' : '💪'}</div>
        <h2 className="text-2xl font-bold mb-2">{t.quiz.done}</h2>
        <p className="text-[var(--text-muted)] mb-6">{correct} / {questions.length} correct · {score}%</p>
        <div className="w-full card mb-6">
          <div className="progress-bar" style={{ height: 12 }}>
            <div className="progress-bar-fill" style={{ width: `${score}%`, height: 12 }} />
          </div>
          <p className="text-center text-sm mt-2 font-medium text-[var(--primary)]">{score}% accuracy</p>
        </div>
        {sessionXP > 0 && (
          <div className="w-full card mb-6 flex items-center justify-center gap-2">
            <span className="text-xl">⚡</span>
            <span className="font-bold" style={{ color: 'var(--warning)' }}>+{displayXP(sessionXP)} XP</span>
          </div>
        )}
        <div className="flex flex-col gap-3 w-full">
          {sourceMyWords && myCollection ? (
            <Link
              href={`/matching?source=my-words&myCollection=${encodeURIComponent(myCollection)}${myFolder ? `&myFolder=${encodeURIComponent(myFolder)}` : ''}`}
              className="w-full flex items-center justify-between px-5 py-4 rounded-2xl text-white"
              style={{ background: 'linear-gradient(135deg, #6366F1, #818CF8)' }}
            >
              <div>
                <div className="font-bold text-sm">Play Matching</div>
                <div className="text-xs opacity-80 mt-0.5">Lock it in with a quick game</div>
              </div>
              <span className="text-lg">→</span>
            </Link>
          ) : collectionName && dayNumber !== undefined && (
            <Link
              href={`/matching?collection=${encodeURIComponent(collectionName)}&day=${dayNumber}`}
              className="w-full flex items-center justify-between px-5 py-4 rounded-2xl text-white"
              style={{ background: 'linear-gradient(135deg, #6366F1, #818CF8)' }}
            >
              <div>
                <div className="font-bold text-sm">Play Matching</div>
                <div className="text-xs opacity-80 mt-0.5">Lock it in with a quick game</div>
              </div>
              <span className="text-lg">→</span>
            </Link>
          )}
          {wrongQuestions.length > 0 && (
            <button
              onClick={() => { setQuestions(wrongQuestions); setIndex(0); setSelected(null); setState('idle'); setCorrect(0); setWrongQuestions([]); setSessionXP(0); setDone(false); }}
              className="w-full py-3 rounded-xl border-2 border-[var(--danger)] text-[var(--danger)] font-bold text-sm hover:bg-red-50 transition-colors"
            >
              {t.quiz.retryWrong(wrongQuestions.length)}
            </button>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => { setIndex(0); setSelected(null); setState('idle'); setCorrect(0); setWrongQuestions([]); setSessionXP(0); setDone(false); if (!sourceMyWords && !sourceClassHW && !sourceClass) setQuestions(buildQuiz(collections, collectionName, dayNumber, starredOnly, listId)); }}
              className="btn-secondary flex-1"
            >{t.common.retry}</button>
            <Link href={backUrl} className="btn-primary flex-1 text-center">{t.common.back}</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!current) return null;

  const typeLabel: Record<QuizType, string> = {
    word_to_translation: t.quiz.translateWord,
    translation_to_word: t.quiz.whatIsWord,
    definition_to_word: t.quiz.matchDef,
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <button onClick={() => {
          if (sourceClassHW && sp.get('hwId')) router.push(`/classes/${sp.get('classId')}/homework/${sp.get('hwId')}`);
          else if (sourceClass && classId) router.push(`/classes/${classId}/words`);
          else router.back();
        }} className="btn-icon" aria-label="Go back">←</button>
        <div className="text-center">
          <div className="font-semibold text-sm">{t.quiz.title}</div>
          <div className="text-xs text-[var(--text-muted)]">{index + 1} / {questions.length}</div>
        </div>
        <div className="badge">{correct} ✓</div>
      </div>

      {/* Progress */}
      <div className="px-4">
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${((index) / questions.length) * 100}%` }} />
        </div>
      </div>

      <div className="flex-1 p-4 flex flex-col gap-4">
        {/* Question */}
        <TiltCard className="card animate-slide-up" intensity={4}>
          <p className="text-xs font-semibold text-[var(--text-muted)] mb-3">{typeLabel[current.type]}</p>
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-xl font-bold text-[var(--text)] flex-1">{current.prompt}</h2>
            <button
              onClick={() => current.word.language ? speakText(current.word.word, current.word.language) : speak(current.word.word)}
              className="w-9 h-9 rounded-full bg-[var(--primary-bg)] flex items-center justify-center flex-shrink-0"
              aria-label="Listen to pronunciation"
            >🔊</button>
          </div>
          {current.type === 'definition_to_word' && (
            <p className="text-xs text-[var(--text-muted)] mt-1 italic">{t.quiz.selectMatch}</p>
          )}
        </TiltCard>

        {/* Options */}
        <div className="space-y-3">
          {current.options.map((opt, i) => {
            let style = 'bg-[var(--surface)] border-2 border-[var(--border)] text-[var(--text)]';
            if (state === 'answered') {
              if (opt === current.correct) style = 'bg-green-50 border-2 border-[var(--success)] text-[var(--success)]';
              else if (opt === selected) style = 'bg-red-50 border-2 border-[var(--danger)] text-[var(--danger)]';
              else style = 'bg-[var(--surface)] border-2 border-[var(--border)] text-[var(--text-muted)] opacity-60';
            }
            return (
              <button
                key={opt}
                onClick={() => handleSelect(opt)}
                disabled={state === 'answered'}
                className={`w-full p-4 rounded-xl text-left font-medium transition-all flex items-center gap-3 ${style} ${state === 'idle' ? 'hover:border-[var(--primary)] hover:text-[var(--primary)] press-3d' : ''}`}
              >
                <span className="w-6 h-6 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                {opt}
                {state === 'answered' && opt === current.correct && <span className="ml-auto text-[var(--success)]">✓</span>}
                {state === 'answered' && opt === selected && opt !== current.correct && <span className="ml-auto text-[var(--danger)]">✗</span>}
              </button>
            );
          })}
        </div>

        {/* Feedback */}
        {state === 'answered' && (
          <div className={`card animate-fade-in ${selected === current.correct ? 'bg-green-50 border-[var(--success)]' : 'bg-red-50 border-[var(--danger)]'}`}>
            <p className="font-semibold mb-1">
              {selected === current.correct ? t.quiz.correct : t.quiz.incorrect}
            </p>
            {selected !== current.correct && (
              <p className="text-sm">{t.quiz.correctAnswer(current.correct)}</p>
            )}
            <p className="text-xs text-[var(--text-muted)] mt-1">{current.word.definition}</p>
          </div>
        )}

        {state === 'answered' && (
          <button onClick={next} className="btn-primary w-full py-4">
            {index + 1 >= questions.length ? t.quiz.seeResults : t.quiz.nextQuestion}
          </button>
        )}

        <div className="text-center text-xs text-[var(--text-muted)]">
          {t.quiz.pressKeys}
        </div>
      </div>
    </div>
  );
}

function Loading() {
  const t = useTranslation();
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <SectionLoader />
        <p className="text-[var(--text-muted)]">{t.quiz.loading}</p>
      </div>
    </div>
  );
}

export default function QuizPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <QuizInner />
    </Suspense>
  );
}

