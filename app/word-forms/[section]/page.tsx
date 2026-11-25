'use client';
import { use, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/useTranslation';
import { PhoneStudyFrame, PhoneModeToggle } from '@/components/PhoneMode';
import { WORD_FORM_SECTIONS, wordFormsIn, type WordFormItem, type WordFormSection } from '@/lib/word-forms-data';
import { getWordFormsMastered, markWordFormsMastered, claimStructurePracticeXP, addXP, displayXP } from '@/lib/storage';

const SESSION_SIZE = 10;
const XP_PER_CORRECT = 3; // same rate as Structures Detective

const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);

// Unmastered items first so a session keeps moving through new pairs.
function buildDeck(section: WordFormSection): WordFormItem[] {
  const mastered = new Set(getWordFormsMastered());
  const items = wordFormsIn(section);
  return [
    ...shuffle(items.filter(w => !mastered.has(w.id))),
    ...shuffle(items.filter(w => mastered.has(w.id))),
  ].slice(0, SESSION_SIZE);
}

function parse(item: WordFormItem) {
  const m = item.sentence.match(/^(.*)\{([^}]+)\}(.*)$/)!;
  const [, before, answer, after] = m;
  const atStart = before === '';
  const cap = (s: string) => (atStart ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  return { before, after, answer: cap(answer), options: shuffle([answer, ...item.wrong]).map(cap) };
}

// Client-only (see the dynamic() below): the deck is shuffled and reads
// localStorage, so it is built once in the initial state, never on the server.
function Drill({ section }: { section: WordFormSection }) {
  const t = useTranslation();
  const router = useRouter();
  const [deck, setDeck] = useState(() => buildDeck(section).map(item => ({ item, q: parse(item) })));
  const [index, setIndex] = useState(0);
  const [tapped, setTapped] = useState<string | null>(null);
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState(false);
  const [xp, setXp] = useState(0);

  const start = () => {
    setDeck(buildDeck(section).map(item => ({ item, q: parse(item) })));
    setIndex(0); setCorrect(0); setDone(false); setXp(0); setTapped(null);
  };

  const current = deck[index]?.item;
  const q = deck[index]?.q;

  const tap = (choice: string) => {
    if (tapped || !q || !current) return;
    setTapped(choice);
    if (choice === q.answer) {
      setCorrect(c => c + 1);
      markWordFormsMastered([current.id]);
    }
  };

  const next = () => {
    if (index + 1 < deck.length) { setIndex(i => i + 1); setTapped(null); return; }
    if (correct > 0 && claimStructurePracticeXP(`word-forms-${section}`)) {
      const amount = correct * XP_PER_CORRECT;
      addXP(amount, 'Word Forms', t.wordForms.sections[section]);
      setXp(amount);
    }
    setDone(true);
  };

  if (deck.length === 0 || !q || !current) return null;

  if (done) {
    const pct = Math.round((correct / deck.length) * 100);
    return (
      <div className="p-6 text-center flex flex-col items-center justify-center min-h-screen animate-fade-in">
        <div className="text-6xl mb-4">{pct >= 80 ? '🏆' : pct >= 50 ? '👍' : '💪'}</div>
        <h2 className="text-2xl font-bold mb-2">{t.wordForms.done}</h2>
        <p className="text-[var(--text-muted)] mb-6">{t.wordForms.correctOf(correct, deck.length)} · {pct}%</p>
        {xp > 0 && (
          <div className="w-full card mb-6 flex items-center justify-center gap-2">
            <span className="text-xl">⚡</span>
            <span className="font-bold" style={{ color: 'var(--warning)' }}>+{displayXP(xp)} XP</span>
          </div>
        )}
        <div className="flex flex-col gap-3 w-full">
          <button onClick={start} className="btn-secondary">{t.wordForms.again}</button>
          <Link href="/word-forms" className="btn-primary text-center">{t.wordForms.back}</Link>
        </div>
      </div>
    );
  }

  const answered = tapped !== null;
  const progress = ((index + (answered ? 1 : 0)) / deck.length) * 100;

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex items-center justify-between p-4">
        <button onClick={() => router.push('/word-forms')} className="btn-icon" aria-label={t.wordForms.back}>✕</button>
        <div className="text-center">
          <div className="font-semibold text-sm">🔀 {t.wordForms.sections[section]}</div>
          <div className="text-xs text-[var(--text-muted)]">{index + 1} / {deck.length}</div>
        </div>
        <PhoneModeToggle />
      </div>

      <div className="px-4">
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="flex-1 p-4 flex flex-col gap-4">
        <div className="card p-5 flex flex-col gap-3">
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">{t.wordForms.chooseForm}</p>
          <p className="text-lg font-semibold text-[var(--text)] leading-snug">
            {q.before}
            {answered
              ? <span className="font-bold" style={{ color: 'var(--success)' }}>{q.answer}</span>
              : <span className="inline-block min-w-[4rem] border-b-2 border-[var(--primary)] text-center">&nbsp;</span>}
            {q.after}
          </p>
          <span className="self-start text-sm font-bold px-3 py-1 rounded-full bg-[var(--primary-bg)] text-[var(--primary)]">
            ({current.base})
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {q.options.map(opt => {
            const isCorrect = opt === q.answer;
            const isTapped = opt === tapped;
            let style: React.CSSProperties = {};
            if (answered && isCorrect) style = { background: 'var(--success)', color: '#fff', borderColor: 'var(--success)' };
            else if (answered && isTapped) style = { background: 'var(--danger)', color: '#fff', borderColor: 'var(--danger)' };
            else if (answered) style = { opacity: 0.4 };
            return (
              <button key={opt} onClick={() => tap(opt)} disabled={answered}
                className="card py-4 px-3 font-semibold text-[var(--text)] text-center transition-all active:translate-y-0.5"
                style={style}>
                {opt}
              </button>
            );
          })}
        </div>

        {answered && (
          <div className="card p-4 flex flex-col gap-1.5 animate-fade-in">
            <div className="font-bold text-[var(--text)]">
              {current.base} → {current.target} <span className="font-normal text-[var(--text-muted)]">· {current.uz}</span>
            </div>
            <div className="text-sm italic text-[var(--text-muted)]">{current.baseSentence}</div>
          </div>
        )}
      </div>

      {answered && (
        <div className="p-4">
          <button onClick={next} className="btn-primary w-full">
            {index + 1 < deck.length ? t.wordForms.next : t.wordForms.finish}
          </button>
        </div>
      )}
    </div>
  );
}

const ClientDrill = dynamic(() => Promise.resolve(Drill), { ssr: false });

export default function WordFormsDrillPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = use(params);
  const t = useTranslation();
  if (!WORD_FORM_SECTIONS.includes(section as WordFormSection)) {
    return (
      <div className="p-6 text-center flex flex-col items-center justify-center min-h-screen">
        <Link href="/word-forms" className="btn-primary inline-block">{t.wordForms.back}</Link>
      </div>
    );
  }
  return (
    <PhoneStudyFrame>
      <ClientDrill section={section as WordFormSection} />
    </PhoneStudyFrame>
  );
}
