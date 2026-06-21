'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { speak, speakText } from '@/lib/speech';
import { addXP, recordStudySession, markQuizComplete, unlockAchievement, getStarredWords, getCustomListWords, getSettings, getUnitProgress, getImportedWords, getImportedWordsByCollection } from '@/lib/storage';
import { fireConfetti } from '@/lib/confetti';
import { checkAchievements } from '@/lib/gamification';
import type { WordItem, WordCollection, QuizType } from '@/lib/types';
import { XP_PER_QUIZ } from '@/lib/types';
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

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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

  const words = (dayNumber !== undefined || starredOnly || listId) ? shuffle(allWords) : shuffle(allWords).slice(0, 10);
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
    const wrongs = shuffle([...new Set(pool)]).slice(0, 3);

    const options = shuffle([correct, ...wrongs]);
    return { word, type, prompt, correct, options };
  });
}

type QuizState = 'idle' | 'answered';

export default function QuizPage() {
  const router = useRouter();
  const [sp, setSp] = useState<URLSearchParams>(() => new URLSearchParams());
  useEffect(() => { setSp(new URLSearchParams(window.location.search)); }, []);
  const collectionName = sp.get('collection') ?? undefined;
  const dayParam = sp.get('day');
  const dayNumber = dayParam ? parseInt(dayParam) : undefined;
  const starredOnly = sp.get('starred') === 'true';
  const listId      = sp.get('list') ?? undefined;
  const sourceMyWords = sp.get('source') === 'my-words';
  const myCollection = sp.get('myCollection') ?? undefined;
  const { collections, collectionsLoaded, pushAchievement, setPendingLevelUp } = useAppStore();

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [state, setState] = useState<QuizState>('idle');
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState(false);
  const [wrongQuestions, setWrongQuestions] = useState<QuizQuestion[]>([]);
  const t = useTranslation();
  const [quizDirection, setQuizDirection] = useState<'word-to-uz' | 'uz-to-word'>('word-to-uz');

  useEffect(() => {
    setQuizDirection(getSettings().quizDirection);
  }, []);

  // Gate: must complete Learn → Cards before Quiz (for unit sessions)
  const [gateInfo, setGateInfo] = useState<{ url: string; missing: string } | null>(null);
  useEffect(() => {
    if (collectionName && dayNumber !== undefined) {
      const p = getUnitProgress(collectionName, dayNumber);
      if (!p.learnDone) {
        setGateInfo({ url: `/learn?collection=${encodeURIComponent(collectionName)}&day=${dayNumber}`, missing: 'Learn' });
      } else if (!p.flashcardDone) {
        setGateInfo({ url: `/flashcards?collection=${encodeURIComponent(collectionName)}&day=${dayNumber}`, missing: 'Flashcards' });
      }
    }
  }, [collectionName, dayNumber]);

  useEffect(() => {
    if (sourceMyWords) {
      const imported = myCollection ? getImportedWordsByCollection(myCollection) : getImportedWords();
      const allWords: QuizWord[] = imported.map(w => ({
        word: w.word, partOfSpeech: '', pronunciation: '',
        translation: w.translation, definition: w.definition,
        example1: w.example1, example1Situation: '', example1Translation: w.example1Translation ?? '',
        example2: w.example2, example2Situation: '', example2Translation: w.example2Translation ?? '',
        example3: '', example3Translation: '', example3Situation: '',
        language: w.language,
        collectionName: 'my-words', topic: myCollection ?? 'My Words', dayNumber: 0,
      }));
      const words = shuffle(allWords);
      const types: QuizType[] = ['word_to_translation', 'translation_to_word', 'definition_to_word'];
      const qs: QuizQuestion[] = words.map((word, i): QuizQuestion => {
        const type = types[i % 3];
        let prompt = '';
        let correct = '';
        if (type === 'word_to_translation') { prompt = word.word; correct = word.translation; }
        else if (type === 'translation_to_word') { prompt = word.translation; correct = word.word; }
        else { prompt = word.definition || word.word; correct = word.word; }
        const pool = allWords.filter(w => w.word !== word.word).map(w => type === 'word_to_translation' ? w.translation : w.word);
        const wrongs = shuffle([...new Set(pool)]).slice(0, 3);
        const options = shuffle([correct, ...wrongs]);
        return { word, type, prompt, correct, options };
      });
      setQuestions(qs);
      return;
    }
    if (collectionsLoaded && collections.length > 0) {
      setQuestions(buildQuiz(collections, collectionName, dayNumber, starredOnly, listId, quizDirection));
    }
  }, [collectionsLoaded, collections, collectionName, dayNumber, starredOnly, listId, quizDirection, sourceMyWords, myCollection]);

  const current = questions[index];

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
  }, [current, state]);

  const handleSelect = useCallback((option: string) => {
    if (state === 'answered') return;
    setSelected(option);
    setState('answered');
    if (option === current?.correct) {
      setCorrect(c => c + 1);
      const { leveledUp, newLevel, newXp } = addXP(XP_PER_QUIZ, 'Quiz');
      if (leveledUp) setPendingLevelUp({ level: newLevel, xp: newXp });
    } else {
      if (current) setWrongQuestions(prev => [...prev, current]);
      const { leveledUp, newLevel, newXp } = addXP(1, 'Quiz');
      if (leveledUp) setPendingLevelUp({ level: newLevel, xp: newXp });
    }
    recordStudySession();
  }, [state, current]);

  const next = useCallback(() => {
    if (index + 1 >= questions.length) {
      // Check perfect score
      if (correct + (selected === current?.correct ? 1 : 0) === questions.length) {
        unlockAchievement('quiz_perfect');
        unlockAchievement('quiz_first');
      } else {
        unlockAchievement('quiz_first');
      }
      if (collectionName) {
        const qDayNumber = dayNumber ?? questions[0]?.word.dayNumber ?? 1;
        markQuizComplete(collectionName, qDayNumber);
        const p = getUnitProgress(collectionName, qDayNumber);
        if (p.learnDone && p.flashcardDone && p.quizDone) fireConfetti();
      }
      const newAchievements = checkAchievements();
      newAchievements.forEach(pushAchievement);
      setDone(true);
    } else {
      setIndex(i => i + 1);
      setSelected(null);
      setState('idle');
    }
  }, [index, questions, correct, selected, current, collectionName, pushAchievement, setPendingLevelUp]);

  if (!collectionName && !starredOnly && !listId && !sourceMyWords) return <UnitPicker mode="quiz" />;

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
    const backUrl = starredOnly ? '/starred' : sourceMyWords ? (myCollection ? `/my-words/${encodeURIComponent(myCollection)}` : '/my-words') : collectionName ? `/collections/${encodeURIComponent(collectionName)}` : '/';
    return (
      <div className="p-6 text-center flex flex-col items-center justify-center min-h-screen animate-fade-in">
        <div className="text-6xl mb-4">{score === 100 ? '🏆' : score >= 80 ? '🎉' : score >= 50 ? '👍' : '💪'}</div>
        <h2 className="text-2xl font-bold mb-2">{t.quiz.done}</h2>
        <p className="text-[var(--text-muted)] mb-6">{correct} / {questions.length} correct · {score}%</p>
        <div className="w-full card mb-6">
          <div className="progress-bar" style={{ height: 12 }}>
            <div className="progress-bar-fill" style={{ width: `${score}%`, height: 12 }} />
          </div>
          <p className="text-center text-sm mt-2 font-medium text-[var(--primary)]">{score}% accuracy</p>
        </div>
        <div className="flex flex-col gap-3 w-full">
          {wrongQuestions.length > 0 && (
            <button
              onClick={() => { setQuestions(wrongQuestions); setIndex(0); setSelected(null); setState('idle'); setCorrect(0); setWrongQuestions([]); setDone(false); }}
              className="w-full py-3 rounded-xl border-2 border-[var(--danger)] text-[var(--danger)] font-bold text-sm hover:bg-red-50 transition-colors"
            >
              {t.quiz.retryWrong(wrongQuestions.length)}
            </button>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => { setIndex(0); setSelected(null); setState('idle'); setCorrect(0); setWrongQuestions([]); setDone(false); if (!sourceMyWords) setQuestions(buildQuiz(collections, collectionName, dayNumber, starredOnly, listId)); }}
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
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-[var(--surface-2)] flex items-center justify-center">←</button>
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
        <div className="text-4xl mb-3 animate-bounce">❓</div>
        <p className="text-[var(--text-muted)]">{t.quiz.loading}</p>
      </div>
    </div>
  );
}
