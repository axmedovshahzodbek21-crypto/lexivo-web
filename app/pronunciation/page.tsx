'use client';
import { PageLoader, SectionLoader } from '@/components/Loader';
import { Suspense } from 'react';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { speakAccent, type Accent } from '@/lib/speech';
import { addXP, getHardWords, getStarredWords, getCustomListWords, getSettings } from '@/lib/storage';
import { checkAchievements } from '@/lib/gamification';
import {
  isRecordingSupported,
  createWhisperRecognizer,
  scoreMatch,
  scoreSentenceMatch,
  diffWords,
  XP_BY_SCORE,
  type MatchScore,
  type Recognizer,
  type DiffToken,
} from '@/lib/pronunciation';
import type { WordItem, WordCollection } from '@/lib/types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PronWord extends WordItem {
  collectionName: string;
  topic: string;
  dayNumber: number;
}

interface SentenceItem {
  text: string;
  wordRef: string;
  translation: string;
}

type PracticeMode = 'words' | 'sentences';
type Phase = 'ready' | 'listening' | 'processing' | 'result' | 'done';

interface WordResult {
  text: string;
  score: MatchScore;
  heard: string;
  xp: number;
}

// ── List builders ─────────────────────────────────────────────────────────────

function buildWordList(
  collections: WordCollection[],
  collectionName?: string, dayNumber?: number,
  starredOnly?: boolean, hardOnly?: boolean, listId?: string,
): PronWord[] {
  if (listId) {
    const ws = getCustomListWords(listId, collections);
    for (let i = ws.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1)); [ws[i], ws[j]] = [ws[j], ws[i]];
    }
    return ws;
  }
  const filterSet = starredOnly ? new Set(getStarredWords()) : hardOnly ? new Set(getHardWords()) : null;
  const words: PronWord[] = [];
  for (const col of collections) {
    if (collectionName && col.name !== collectionName) continue;
    for (const day of col.days) {
      if (dayNumber !== undefined && day.dayNumber !== dayNumber) continue;
      for (const word of day.words) {
        if (filterSet && !filterSet.has(word.word)) continue;
        words.push({ ...word, collectionName: col.name, topic: day.topic, dayNumber: day.dayNumber });
      }
    }
  }
  for (let i = words.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); [words[i], words[j]] = [words[j], words[i]];
  }
  return dayNumber !== undefined || starredOnly || hardOnly ? words : words.slice(0, 15);
}

function buildSentenceList(
  collections: WordCollection[],
  collectionName?: string,
  dayNumber?: number,
): SentenceItem[] {
  const items: SentenceItem[] = [];
  for (const col of collections) {
    if (collectionName && col.name !== collectionName) continue;
    for (const day of col.days) {
      if (dayNumber !== undefined && day.dayNumber !== dayNumber) continue;
      for (const word of day.words) {
        if (word.example1) items.push({ text: word.example1, wordRef: word.word, translation: word.translation });
        if (word.example2) items.push({ text: word.example2, wordRef: word.word, translation: word.translation });
      }
    }
  }
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]];
  }
  return items.slice(0, 15);
}

// ── Main component ────────────────────────────────────────────────────────────

function PronunciationInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { collections, collectionsLoaded } = useAppStore();

  const collectionParam = searchParams.get('collection') ?? undefined;
  const dayParam        = searchParams.get('day') ? parseInt(searchParams.get('day')!) : undefined;
  const starredParam    = searchParams.get('starred') === 'true';
  const hardParam       = searchParams.get('hard') === 'true';
  const listId          = searchParams.get('list') ?? undefined;

  const [supported]  = useState(() => isRecordingSupported());
  const [mode, setMode]             = useState<PracticeMode>('words');
  const [accent, setAccent]         = useState<Accent>(() => getSettings().defaultAccent);
  const [autoPlay, setAutoPlay]     = useState(true);

  const [wordItems, setWordItems]         = useState<PronWord[]>([]);
  const [sentenceItems, setSentenceItems] = useState<SentenceItem[]>([]);

  const [index,   setIndex]   = useState(0);
  const [phase,   setPhase]   = useState<Phase>('ready');
  const [heardText, setHeardText] = useState('');
  const [score,   setScore]   = useState<MatchScore | null>(null);
  const [diff,    setDiff]    = useState<DiffToken[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [results, setResults] = useState<WordResult[]>([]);
  const [totalXp, setTotalXp] = useState(0);
  const [micError, setMicError] = useState('');
  const [translationVisible, setTranslationVisible] = useState(false);

  const recognizerRef = useRef<Recognizer | null>(null);

  useEffect(() => {
    if (!collectionsLoaded) return;
    setWordItems(buildWordList(collections, collectionParam, dayParam, starredParam, hardParam, listId));
    setSentenceItems(buildSentenceList(collections, collectionParam, dayParam));
  }, [collectionsLoaded, collections, collectionParam, dayParam, starredParam, hardParam, listId]);

  // Reset index/phase on mode switch
  useEffect(() => {
    setIndex(0); setPhase('ready'); setResults([]); setTotalXp(0);
  }, [mode]);

  const activeItems = mode === 'words' ? wordItems : sentenceItems;
  const currentItem = activeItems[index] ?? null;
  const currentText = mode === 'words'
    ? (currentItem as PronWord)?.word ?? ''
    : (currentItem as SentenceItem)?.text ?? '';

  // Reset card state + optional auto-play when item changes
  useEffect(() => {
    if (!currentText) return;
    setTranslationVisible(false);
    setHeardText('');
    setScore(null);
    setDiff([]);
    setAttempt(0);
    if (autoPlay && phase === 'ready') {
      const delay = setTimeout(() => speakAccent(currentText, accent), 300);
      return () => clearTimeout(delay);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentText, phase]);

  const startListening = useCallback(() => {
    if (!currentText) return;
    setMicError('');
    setHeardText('');

    const rec = createWhisperRecognizer(
      (transcripts) => {
        const best = transcripts[0] ?? '';
        setHeardText(best);
        const s = mode === 'sentences'
          ? scoreSentenceMatch(transcripts, currentText)
          : scoreMatch(transcripts, currentText);
        setScore(s);
        setDiff(best ? diffWords(best, currentText) : []);
        setPhase('result');
      },
      () => { setPhase(prev => prev === 'listening' ? 'result' : prev); },
      (err) => {
        setMicError(
          err === 'not-allowed' ? 'blocked'
          : err === 'no-api-key' ? 'no-api-key'
          : err === 'network'   ? 'network'
          : `Mic error: ${err}`,
        );
        setPhase('ready');
      },
      () => { setPhase('listening'); },
      () => { setPhase('processing'); },
    );

    recognizerRef.current = rec;
    rec.start();
  }, [currentText, mode, accent]);

  const stopListening = useCallback(() => {
    recognizerRef.current?.stop();
    recognizerRef.current = null;
  }, []);

  const advance = useCallback(() => {
    if (!currentText || score === null) return;
    const xp = XP_BY_SCORE[score];
    if (xp > 0) { addXP(xp, 'Pronunciation'); checkAchievements(); }
    setResults(prev => [...prev, { text: currentText, score, heard: heardText, xp }]);
    setTotalXp(prev => prev + xp);
    if (index + 1 >= activeItems.length) setPhase('done');
    else { setIndex(prev => prev + 1); setPhase('ready'); }
  }, [currentText, score, heardText, index, activeItems.length]);

  const retry = useCallback(() => {
    setAttempt(1); setScore(null); setHeardText(''); setDiff([]); setPhase('ready');
  }, []);

  // ── Not supported ────────────────────────────────────────────────────────
  if (!supported) {
    return (
      <div className="p-6 text-center space-y-4 animate-fade-in">
        <div className="text-6xl">🎙️</div>
        <h2 className="text-xl font-bold text-[var(--text)]">Microphone not supported</h2>
        <p className="text-sm text-[var(--text-muted)] max-w-xs mx-auto leading-relaxed">
          Try opening this page in <strong>Chrome</strong>, <strong>Firefox</strong>, or <strong>Safari</strong> on a modern device.
        </p>
        <button onClick={() => router.back()} className="btn-secondary">← Go back</button>
      </div>
    );
  }

  if (!collectionsLoaded) {
    return <PageLoader />;
  }

  if (activeItems.length === 0) {
    return (
      <div className="p-6 text-center space-y-4 animate-fade-in">
        <div className="text-6xl">📭</div>
        <h2 className="text-xl font-bold">No items to practice</h2>
        <Link href="/" className="btn-primary inline-block">← Home</Link>
      </div>
    );
  }

  // ── Done screen ──────────────────────────────────────────────────────────
  if (phase === 'done') {
    const perfect = results.filter(r => r.score === 'perfect').length;
    const close   = results.filter(r => r.score === 'close').length;
    const wrong   = results.filter(r => r.score === 'wrong').length;
    return (
      <div className="flex flex-col min-h-screen animate-fade-in">
        <div className="p-4 border-b border-[var(--border)]">
          <button onClick={() => router.back()} className="text-sm text-[var(--text-muted)] mb-3 flex items-center gap-1 hover:text-[var(--text)]">← Back</button>
          <h1 className="text-xl font-bold">🎙️ Practice Complete!</h1>
        </div>
        <div className="flex-1 p-4 space-y-4">
          <div className="card text-center space-y-3">
            <div className="text-5xl">{perfect >= results.length * 0.8 ? '🏆' : perfect >= results.length * 0.5 ? '🌟' : '💪'}</div>
            <p className="text-2xl font-bold text-[var(--text)]">+{totalXp} XP</p>
            <div className="grid grid-cols-3 gap-3">
              <ScorePill count={perfect} label="Perfect" color="green" />
              <ScorePill count={close}   label="Close"   color="amber" />
              <ScorePill count={wrong}   label="Missed"  color="red" />
            </div>
          </div>

          <div className="space-y-2">
            {results.map((r, i) => (
              <div key={i} className="card flex items-start gap-3">
                <ScoreIcon score={r.score} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[var(--text)] text-sm leading-snug">{r.text}</p>
                  {r.heard && (
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      You said: <span className="italic">&ldquo;{r.heard}&rdquo;</span>
                    </p>
                  )}
                </div>
                <span className="text-xs font-bold text-[var(--primary)] shrink-0">+{r.xp} XP</span>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { setIndex(0); setResults([]); setTotalXp(0); setPhase('ready'); }}
              className="flex-1 btn-primary"
            >
              Practice Again
            </button>
            <button onClick={() => router.back()} className="flex-1 btn-secondary">Done</button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentItem) return null;

  const wordItem     = mode === 'words'     ? (currentItem as PronWord)     : null;
  const sentenceItem = mode === 'sentences' ? (currentItem as SentenceItem) : null;

  // ── Practice screen ──────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen animate-fade-in">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border)]">
        <button
          onClick={() => { recognizerRef.current?.abort(); router.back(); }}
          className="text-sm text-[var(--text-muted)] mb-3 flex items-center gap-1 hover:text-[var(--text)]"
        >
          ← Back
        </button>
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-[var(--text)]">🎙️ Pronunciation</h1>
          <span className="text-sm text-[var(--text-muted)]">{index + 1} / {activeItems.length}</span>
        </div>
        <div className="progress-bar" style={{ height: 4 }}>
          <div className="progress-bar-fill" style={{ width: `${(index / activeItems.length) * 100}%`, height: 4 }} />
        </div>
      </div>

      {/* Controls bar: mode · accent · auto-play */}
      <div className="px-4 py-3 flex items-center gap-2 border-b border-[var(--border)] flex-wrap">
        {/* Mode */}
        <div className="flex rounded-xl overflow-hidden border border-[var(--border)] shrink-0">
          {(['words', 'sentences'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors ${mode === m ? 'bg-[var(--primary)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text)]'}`}
            >
              {m === 'words' ? '💬 Words' : '📝 Sentences'}
            </button>
          ))}
        </div>

        {/* Accent */}
        <div className="flex rounded-xl overflow-hidden border border-[var(--border)] shrink-0">
          {(['us', 'uk'] as const).map(a => (
            <button
              key={a}
              onClick={() => setAccent(a)}
              title={a === 'us' ? 'American English' : 'British English'}
              className={`px-2.5 py-1.5 text-sm transition-colors ${accent === a ? 'bg-[var(--primary)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text)]'}`}
            >
              {a === 'us' ? '🇺🇸' : '🇬🇧'}
            </button>
          ))}
        </div>

        {/* Auto-play */}
        <button
          onClick={() => setAutoPlay(v => !v)}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${autoPlay ? 'bg-[var(--primary-bg)] border-[var(--primary)] text-[var(--primary)]' : 'border-[var(--border)] text-[var(--text-muted)]'}`}
        >
          🔊 Auto
        </button>
      </div>

      {/* Card + controls */}
      <div className="flex-1 flex flex-col items-center justify-center p-5 gap-6">

        {/* Word mode card */}
        {wordItem && (
          <div className="w-full max-w-sm card text-center space-y-2">
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide font-semibold">{wordItem.partOfSpeech}</p>
            <h2 className="text-4xl font-bold text-[var(--text)]">{wordItem.word}</h2>
            <p className="text-base text-[var(--text-muted)] font-mono">{wordItem.pronunciation}</p>
            {translationVisible ? (
              <div className="pt-1 animate-fade-in">
                <p className="text-base font-semibold text-[var(--primary)]">{wordItem.translation}</p>
                <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">{wordItem.definition}</p>
              </div>
            ) : (
              <button onClick={() => setTranslationVisible(true)} className="text-xs text-[var(--primary)] font-medium hover:underline">
                Show translation
              </button>
            )}
            <HearButtons text={wordItem.word} accent={accent} />
          </div>
        )}

        {/* Sentence mode card */}
        {sentenceItem && (
          <div className="w-full max-w-sm card space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="badge">📝 Sentence</span>
              <span className="text-xs text-[var(--text-muted)]">from: <strong>{sentenceItem.wordRef}</strong></span>
            </div>
            <p className="text-lg font-semibold text-[var(--text)] leading-snug">
              &ldquo;{sentenceItem.text}&rdquo;
            </p>
            {translationVisible ? (
              <p className="text-sm text-[var(--primary)] animate-fade-in">{sentenceItem.translation}</p>
            ) : (
              <button onClick={() => setTranslationVisible(true)} className="text-xs text-[var(--primary)] font-medium hover:underline">
                Show word translation
              </button>
            )}
            <HearButtons text={sentenceItem.text} accent={accent} rate={0.85} />
          </div>
        )}

        {/* Mic permission denied */}
        {micError === 'blocked' && phase === 'ready' && (
          <div className="w-full max-w-sm card border border-[var(--danger)] bg-red-50 space-y-3 text-center animate-fade-in">
            <div className="text-4xl">🎙️🚫</div>
            <p className="font-bold text-[var(--danger)]">Microphone Blocked</p>
            <p className="text-sm text-[var(--text-muted)]">Allow microphone access and try again:</p>
            <ol className="text-sm text-[var(--text)] text-left space-y-1 list-decimal list-inside">
              <li>Click the <strong>🔒 lock icon</strong> in the address bar</li>
              <li>Find <strong>Microphone</strong> → set to <strong>Allow</strong></li>
              <li>Refresh, then tap the mic again</li>
            </ol>
            <button onClick={() => window.location.reload()} className="btn-primary w-full">Refresh page</button>
          </div>
        )}

        {/* API key not configured */}
        {micError === 'no-api-key' && phase === 'ready' && (
          <div className="w-full max-w-sm card border border-amber-400 bg-amber-50 space-y-2 text-center animate-fade-in">
            <div className="text-4xl">🔑</div>
            <p className="font-bold text-amber-700">Speech service not set up</p>
            <p className="text-sm text-[var(--text-muted)]">
              Add <code className="bg-amber-100 px-1 rounded text-xs">OPENAI_API_KEY</code> to your Vercel environment variables to enable pronunciation checking.
            </p>
            <button onClick={() => setMicError('')} className="btn-secondary w-full">Dismiss</button>
          </div>
        )}

        {/* Network error */}
        {micError === 'network' && phase === 'ready' && (
          <div className="w-full max-w-sm card border border-[var(--border)] space-y-2 text-center animate-fade-in">
            <div className="text-4xl">📡</div>
            <p className="font-bold text-[var(--text)]">Connection error</p>
            <p className="text-sm text-[var(--text-muted)]">Could not reach the speech service. Check your internet and try again.</p>
            <button onClick={() => setMicError('')} className="btn-primary w-full">Try again</button>
          </div>
        )}

        {/* Other errors */}
        {micError && !['blocked','no-api-key','network'].includes(micError) && phase === 'ready' && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs text-[var(--danger)] text-center max-w-xs">{micError}</p>
            <button onClick={() => setMicError('')} className="text-xs text-[var(--primary)] underline">Try again</button>
          </div>
        )}

        {/* Processing indicator */}
        {phase === 'processing' && (
          <div className="flex flex-col items-center gap-3 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-[var(--primary-bg)] flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-sm text-[var(--text-muted)]">Analysing your pronunciation…</p>
          </div>
        )}

        {/* Mic button */}
        {(phase === 'ready' || phase === 'listening') && !micError && (
          <div className="flex flex-col items-center gap-3">
            {attempt === 1 && phase === 'ready' && (
              <p className="text-xs text-amber-600 font-medium">Retry — try once more!</p>
            )}
            <button
              onClick={phase === 'listening' ? stopListening : startListening}
              className={`w-24 h-24 rounded-full flex items-center justify-center text-4xl shadow-lg transition-all select-none
                ${phase === 'listening'
                  ? 'bg-[var(--danger)] text-white scale-110 shadow-red-300 animate-pulse'
                  : 'bg-[var(--primary)] text-white hover:scale-105 hover:shadow-xl'
                }`}
            >
              {phase === 'listening' ? '⏹' : '🎙️'}
            </button>
            <p className="text-sm text-[var(--text-muted)]">
              {phase === 'listening' ? 'Listening… tap to stop' : 'Tap to speak'}
            </p>
          </div>
        )}

        {/* Result panel */}
        {phase === 'result' && score !== null && (
          <div className="w-full max-w-sm animate-fade-in space-y-3">
            <ResultBanner score={score} heard={heardText} diff={diff} target={currentText} />
            <div className="flex gap-3">
              {score === 'wrong' && attempt === 0 ? (
                <>
                  <button onClick={retry} className="flex-1 btn-secondary">🔄 Try again</button>
                  <button onClick={advance} className="flex-1 btn-primary">Skip →</button>
                </>
              ) : (
                <button onClick={advance} className="w-full btn-primary">
                  {index + 1 < activeItems.length ? 'Next →' : 'See results →'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function HearButtons({ text, accent, rate = 0.9 }: { text: string; accent: Accent; rate?: number }) {
  return (
    <div className="flex justify-center gap-2 pt-1">
      <button
        onClick={() => speakAccent(text, 'us', rate)}
        className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${accent === 'us' ? 'bg-[var(--primary)] text-white' : 'bg-[var(--primary-bg)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white'}`}
      >
        🇺🇸 Hear
      </button>
      <button
        onClick={() => speakAccent(text, 'uk', rate)}
        className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${accent === 'uk' ? 'bg-[var(--primary)] text-white' : 'bg-[var(--primary-bg)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white'}`}
      >
        🇬🇧 Hear
      </button>
    </div>
  );
}

function ResultBanner({
  score, heard, diff, target,
}: {
  score: MatchScore; heard: string; diff: DiffToken[]; target: string;
}) {
  const cfg = {
    perfect: { bg: 'bg-green-50', border: 'border-[var(--success)]', icon: '✅', label: 'Perfect!',   color: 'text-[var(--success)]' },
    close:   { bg: 'bg-amber-50', border: 'border-amber-300',        icon: '🔶', label: 'Almost!',    color: 'text-amber-700' },
    wrong:   { bg: 'bg-red-50',   border: 'border-[var(--danger)]',  icon: '❌', label: 'Not quite',  color: 'text-[var(--danger)]' },
  }[score];

  return (
    <div className={`rounded-2xl border p-4 ${cfg.bg} ${cfg.border} space-y-3`}>
      <div className="flex items-center gap-2">
        <span className="text-2xl">{cfg.icon}</span>
        <span className={`font-bold text-lg ${cfg.color}`}>{cfg.label}</span>
        <span className="ml-auto text-sm font-bold text-[var(--primary)]">+{XP_BY_SCORE[score]} XP</span>
      </div>

      {/* Visual word diff */}
      {diff.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {diff.map((token, i) => (
            <span
              key={i}
              className={`px-1.5 py-0.5 rounded text-sm font-medium ${token.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800 line-through'}`}
            >
              {token.text}
            </span>
          ))}
        </div>
      ) : score !== 'perfect' && (
        <p className="text-sm text-[var(--text-muted)]">No speech detected.</p>
      )}

      {heard && (
        <p className="text-xs text-[var(--text-muted)]">
          You said: <span className="italic font-medium text-[var(--text)]">&ldquo;{heard}&rdquo;</span>
        </p>
      )}

      {score !== 'perfect' && (
        <p className="text-xs text-[var(--text-muted)]">
          Target: <span className="font-semibold text-[var(--text)]">{target}</span>
        </p>
      )}
    </div>
  );
}

function ScoreIcon({ score }: { score: MatchScore }) {
  return <span className="text-xl mt-0.5 shrink-0">{score === 'perfect' ? '✅' : score === 'close' ? '🔶' : '❌'}</span>;
}

function ScorePill({ count, label, color }: { count: number; label: string; color: 'green' | 'amber' | 'red' }) {
  const cls = {
    green: 'bg-green-50 text-[var(--success)]',
    amber: 'bg-amber-50 text-amber-600',
    red:   'bg-red-50 text-[var(--danger)]',
  }[color];
  return (
    <div className={`rounded-xl p-3 ${cls}`}>
      <div className="text-xl font-bold">{count}</div>
      <div className="text-xs text-[var(--text-muted)]">{label}</div>
    </div>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────

export default function PronunciationPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <PronunciationInner />
    </Suspense>
  );
}

