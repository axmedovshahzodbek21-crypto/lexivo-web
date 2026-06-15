'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/useTranslation';
import { useAppStore } from '@/lib/store';
import { getWordOfDay } from '@/lib/data';
import { getStreak, getXP, getTodayXP, getTodayLearnedCount, getDueWords, getLearnedWords, getSettings, isOnboarded, getFreezes, checkAndGrantWeeklyFreeze, getImportedWords } from '@/lib/storage';
import { getLevelInfo } from '@/lib/gamification';
import { speak } from '@/lib/speech';
import { getTheme, toggleTheme, type Theme } from '@/lib/theme';
import type { WordItem, UserSettings } from '@/lib/types';
import XpModal from '@/components/XpModal';
import TiltCard from '@/components/TiltCard';

const COLLECTION_META: Record<string, { icon: string; color: string; desc: string }> = {
  '30 Days of Powerful Words': { icon: '🏆', color: '#6C63FF', desc: 'Essential IELTS vocabulary by topic' },
  '24 Vocabulary Challenge':   { icon: '💡', color: '#FF6584', desc: 'Idioms and phrases for fluent speakers' },
  'Word Mastery':              { icon: '🎯', color: '#2ECC71', desc: 'High-level C1 & B2 collocations' },
};

const LEVELED_NAMES = new Set(['A1', 'A2', 'B1', 'Advanced']);

export default function HomePage() {
  const router = useRouter();
  const { collections, collectionsLoaded } = useAppStore();
  const [wod, setWod] = useState<WordItem | null>(null);
  const [streak, setStreak] = useState(0);
  const [xp, setXp] = useState(0);
  const [todayXp, setTodayXp] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [dueCount, setDueCount] = useState(0);
  const [learnedCount, setLearnedCount] = useState(0);
  const [settings, setSettings] = useState<UserSettings>({ name: 'Learner', dailyGoal: 10, languageLevel: 'B1', defaultAccent: 'us', autoPlayOnReveal: true, sessionSize: 20, fontSize: 'normal', studyOrder: 'random', quizDirection: 'word-to-uz', reduceMotion: false, uiLanguage: 'en' });
  const [freezes, setFreezes] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [wodRevealed, setWodRevealed] = useState(false);
  const [theme, setThemeState] = useState<Theme>('light');
  const [showXpModal, setShowXpModal] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (!isOnboarded()) { router.replace('/onboarding'); return; }
    checkAndGrantWeeklyFreeze();
    setStreak(getStreak());
    setFreezes(getFreezes());
    setXp(getXP());
    setTodayXp(getTodayXP());
    setTodayCount(getTodayLearnedCount());
    setDueCount(getDueWords().length);
    setLearnedCount(getLearnedWords().length);
    setSettings(getSettings());
    setThemeState(getTheme());
    setImportedCount(getImportedWords().length);
    if (!localStorage.getItem('android_banner_seen')) {
      localStorage.setItem('android_banner_seen', '1');
      setShowBanner(true);
    }
  }, [router]);

  useEffect(() => {
    if (collectionsLoaded && collections.length > 0) {
      setWod(getWordOfDay(collections));
    }
  }, [collectionsLoaded, collections]);

  useEffect(() => {
    const handleSync = () => {
      setStreak(getStreak());
      setXp(getXP());
      setTodayXp(getTodayXP());
      setTodayCount(getTodayLearnedCount());
      setDueCount(getDueWords().length);
      setLearnedCount(getLearnedWords().length);
    };
    window.addEventListener('lexivo-sync', handleSync);
    return () => window.removeEventListener('lexivo-sync', handleSync);
  }, []);

  const t = useTranslation();
  const levelInfo = getLevelInfo(xp);
  const dailyProgress = Math.min((todayCount / settings.dailyGoal) * 100, 100);
  const mainCollections = collections.filter(c => !LEVELED_NAMES.has(c.name));

  return (
    <div className="p-4 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">Hi, {settings.name}! 👋</h1>
          <p className="text-sm text-[var(--text-muted)]">{t.home.readyToLearn}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { const next = toggleTheme(); setThemeState(next); }}
            className="w-10 h-10 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-lg hover:bg-[var(--primary-bg)] transition-colors"
            title={t.home.toggleDark}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <Link href="/settings" className="w-10 h-10 rounded-full bg-[var(--primary-bg)] flex items-center justify-center text-lg">
            ⚙️
          </Link>
        </div>
      </div>

      {/* ── Download banner (shown once) ── */}
      {showBanner && (
        <a
          href="https://github.com/axmedovshahzodbek21-crypto/lexivo-web/releases/latest/download/app-release.apk"
          download
          className="flex items-center gap-4 p-4 rounded-2xl border-2 transition-colors"
          style={{ background: 'rgba(61,220,132,0.08)', borderColor: 'rgba(61,220,132,0.35)' }}
        >
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: 'rgba(61,220,132,0.15)' }}>
            🤖
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm" style={{ color: '#3DDC84' }}>{t.home.downloadApp}</div>
            <div className="text-xs mt-0.5 text-[var(--text-muted)]">{t.home.downloadSub}</div>
          </div>
          <span className="text-sm font-bold flex-shrink-0" style={{ color: '#3DDC84' }}>↓</span>
        </a>
      )}

      {/* ── Collections (most important, lifted to top) ── */}
      <div>
        <h2 className="font-semibold text-[var(--text)] text-base mb-3">{t.home.collections}</h2>
        <div className="space-y-3">
          {/* My Words — always shown so new users can discover import */}
          <TiltCard className="card overflow-hidden hover:border-[var(--primary)] transition-colors" intensity={6}>
            <Link href={importedCount > 0 ? '/my-words' : '/import'} className="flex items-center gap-4" style={{ margin: '-20px', padding: '20px' }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 animate-float-icon" style={{ background: 'rgba(108,99,255,0.12)' }}>
                ✍️
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[var(--text)] text-sm">{t.myWords.title}</div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">{t.myWords.subtitle}</div>
                <div className="text-xs text-[var(--text-muted)] mt-1">
                  {importedCount > 0 ? t.myWords.wordCount(importedCount) : t.myWords.addWords}
                </div>
              </div>
              <span className="flex-shrink-0 text-sm font-semibold" style={{ color: 'var(--primary)' }}>
                {importedCount > 0 ? '→' : '+'}
              </span>
            </Link>
          </TiltCard>

          {/* Curated collections first */}
          {mainCollections.map(col => {
            const meta = COLLECTION_META[col.name] ?? { icon: '📖', color: '#6C63FF', desc: col.description };
            const enc = encodeURIComponent(col.name);
            const wordCount = col.days.reduce((a, d) => a + d.words.length, 0);
            return (
              <TiltCard
                key={col.name}
                className="card overflow-hidden hover:border-[var(--primary)] transition-colors"
                style={{ boxShadow: `0 4px 14px ${meta.color}22` }}
                intensity={6}
              >
                <Link href={`/collections/${enc}`} className="flex items-center gap-4" style={{ margin: '-20px', padding: '20px' }}>
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 animate-float-icon"
                    style={{ background: `${meta.color}18` }}
                  >
                    {meta.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[var(--text)] text-sm truncate">{col.name}</div>
                    <div className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{meta.desc}</div>
                    <div className="text-xs text-[var(--text-muted)] mt-1">{col.days.length} units · {wordCount} words</div>
                  </div>
                  <span className="flex-shrink-0 text-sm font-semibold" style={{ color: meta.color }}>→</span>
                </Link>
              </TiltCard>
            );
          })}

          {/* Leveled Words — last */}
          <TiltCard
            className="overflow-hidden rounded-2xl border-2 cursor-pointer"
            style={{ background: 'rgba(46,204,113,0.06)', borderColor: 'rgba(46,204,113,0.35)' }}
            intensity={5}
          >
            <Link href="/leveled-words" className="flex items-center gap-4 p-4 block">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 animate-float-icon" style={{ background: 'rgba(46,204,113,0.12)' }}>
                📚
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm" style={{ color: '#27AE60' }}>{t.home.leveledWords}</div>
                <div className="text-xs mt-0.5" style={{ color: '#2ECC71' }}>A1 → C2 vocabulary by CEFR level</div>
              </div>
              <span className="text-sm flex-shrink-0" style={{ color: '#2ECC71' }}>→</span>
            </Link>
          </TiltCard>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <Link href="/progress?tab=calendar">
          <StatCard icon="🔥" value={streak} label={t.home.dayStreak} color="#FF6B35" />
        </Link>
        <button onClick={() => setShowXpModal(true)} className="text-left w-full">
          <StatCard icon="⚡" value={xp} label={t.home.totalXp} color="#6C63FF" glow />
        </button>
        <Link href="/history">
          <StatCard icon="📚" value={learnedCount} label={t.home.words} color="#10B981" />
        </Link>
      </div>

      {showXpModal && <XpModal xp={xp} onClose={() => setShowXpModal(false)} />}

      {/* Streak freeze indicator */}
      {freezes > 0 && (
        <div
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium"
          style={{ background: 'rgba(99,179,237,0.12)', border: '1px solid rgba(99,179,237,0.35)', color: '#3B82F6' }}
        >
          <span className="text-base">🧊</span>
          <span>
            {freezes === 1 ? t.home.freezeSingle : t.home.freezeMulti(freezes)}
          </span>
        </div>
      )}

      {/* Level progress */}
      <TiltCard className="card overflow-hidden hover:border-[var(--primary)] transition-colors cursor-pointer animate-glow-pulse" intensity={4}>
        <button onClick={() => setShowXpModal(true)} className="w-full text-left" style={{ margin: '-20px', padding: '20px' }}>
          <div className="flex justify-between items-center mb-2">
            <span className="font-semibold text-[var(--text)]">⭐ {levelInfo.level}</span>
            <span className="text-sm text-[var(--text-muted)]">{xp} XP {levelInfo.next && `→ ${levelInfo.next}`}</span>
          </div>
          <div className="progress-bar">
            <div className="progress-bar-fill" style={{ width: `${levelInfo.progress}%` }} />
          </div>
          {levelInfo.next && (
            <p className="text-[11px] text-[var(--text-muted)] mt-1.5 text-right">
              {levelInfo.xpToNext} XP to {levelInfo.next} · tap for details
            </p>
          )}
        </button>
      </TiltCard>

      {/* Daily goal */}
      <TiltCard className="card" intensity={3}>
        <div className="flex justify-between items-center mb-2">
          <span className="font-semibold text-[var(--text)]">{t.home.dailyGoal}</span>
          <span className="text-sm text-[var(--text-muted)]">{t.home.wordsToday(todayCount, settings.dailyGoal)} · {todayXp} XP today</span>
        </div>
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${dailyProgress}%` }} />
        </div>
        {dailyProgress >= 100 && (
          <p className="text-xs text-[var(--success)] mt-1 font-medium">{t.home.goalReached}</p>
        )}
      </TiltCard>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <ActionCard href="/learn"         icon="📖" title={t.home.learnTitle}     subtitle={t.home.learnSub}          color="#6C63FF" depthClass="depth-in-1" />
        <ActionCard href="/flashcards"    icon="🃏" title={t.home.flashcardsTitle} subtitle={t.home.flashcardsSub}     color="#FF6B35" depthClass="depth-in-2" />
        <ActionCard
          href="/srs"
          icon="🔄"
          title={t.home.srsTitle}
          subtitle={dueCount > 0 ? t.home.srsDue(dueCount) : t.home.srsAllCaughtUp}
          color={dueCount > 0 ? '#EF4444' : '#10B981'}
          badge={dueCount > 0 ? String(dueCount) : undefined}
          depthClass="depth-in-3"
        />
        <ActionCard href="/quiz"          icon="❓" title={t.home.quizTitle}       subtitle={t.home.quizSub}           color="#F59E0B" depthClass="depth-in-4" />
        <ActionCard href="/pronunciation" icon="🎙️" title={t.home.pronounceTitle}  subtitle={t.home.pronounceSub}      color="#8B5CF6" depthClass="depth-in-5" />
        <ActionCard href="/matching"      icon="🎯" title={t.home.matchTitle}       subtitle={t.home.matchSub}          color="#EC4899" depthClass="depth-in-6" />
        <ActionCard href="/pomodoro"      icon="🍅" title={t.home.pomodoroTitle}    subtitle={t.home.pomodoroSub}       color="#EF4444" depthClass="depth-in-7" />
      </div>

      {/* Word of the Day */}
      {wod && (
        <TiltCard className="card" intensity={3}>
          <div className="flex items-center justify-between mb-3">
            <span className="badge">{t.home.wordOfDay}</span>
            <button
              onClick={() => speak(wod.word)}
              className="w-8 h-8 rounded-full bg-[var(--primary-bg)] flex items-center justify-center text-sm hover:bg-[var(--primary)] hover:text-white transition-colors"
              title={t.home.listen}
            >
              🔊
            </button>
          </div>
          <h2 className="text-2xl font-bold text-[var(--text)]">{wod.word}</h2>
          <p className="text-sm text-[var(--text-muted)] mb-1">{wod.partOfSpeech} · {wod.pronunciation}</p>
          <p className="text-base font-medium text-[var(--primary)]">{wod.translation}</p>
          {wodRevealed ? (
            <div className="mt-3 space-y-2 animate-fade-in">
              <p className="text-sm text-[var(--text)]">{wod.definition}</p>
              <div className="bg-[var(--primary-bg)] rounded-xl p-3">
                <p className="text-sm italic text-[var(--text)]">"{wod.example1}"</p>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setWodRevealed(true)}
              className="mt-3 text-sm text-[var(--primary)] font-medium hover:underline"
            >
              {t.home.showDefinition}
            </button>
          )}
        </TiltCard>
      )}

      {/* Shortcuts — 2 rows of 3 */}
      <div className="grid grid-cols-3 gap-2">
        <ShortcutCard href="/starred"      icon="⭐" label={t.home.starredTitle}  sub={t.home.starredSub}  accent="var(--primary)" />
        <ShortcutCard href="/hard-words"   icon="😓" label={t.home.hardTitle}    sub={t.home.hardSub}     accent="var(--danger)"  />
        <ShortcutCard href="/history"      icon="📖" label={t.home.historyTitle} sub={t.home.historySub}  accent="var(--primary)" />
        <ShortcutCard href="/lists"        icon="📋" label={t.home.listsTitle}   sub={t.home.listsSub}    accent="#8B5CF6"        />
        <ShortcutCard href="/grammar-tips" icon="📚" label={t.home.grammarTitle} sub={t.home.grammarSub}  accent="#10B981"        />
      </div>

      <div className="pb-4" />
    </div>
  );
}

function StatCard({ icon, value, label, color, glow }: { icon: string; value: number; label: string; color: string; glow?: boolean }) {
  return (
    <TiltCard className={`card text-center py-3 px-2${glow ? ' animate-glow-pulse' : ''}`} intensity={5}>
      <div className="text-2xl mb-1 animate-float-icon">{icon}</div>
      <div className="text-xl font-bold" style={{ color }}>{value}</div>
      <div className="text-xs text-[var(--text-muted)]">{label}</div>
    </TiltCard>
  );
}

function ActionCard({
  href, icon, title, subtitle, color, badge, depthClass
}: {
  href: string; icon: string; title: string; subtitle: string; color: string; badge?: string; depthClass?: string;
}) {
  return (
    <div className={`relative${depthClass ? ` ${depthClass}` : ''}`}>
      {badge && (
        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[var(--danger)] text-white text-xs flex items-center justify-center font-bold z-10">
          {parseInt(badge) > 9 ? '9+' : badge}
        </div>
      )}
      <TiltCard className="card flex items-center gap-3 cursor-pointer" intensity={6}>
        <Link href={href} className="flex items-center gap-3 w-full" style={{ margin: '-20px', padding: '20px' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 animate-float-icon" style={{ background: `${color}20` }}>
            {icon}
          </div>
          <div>
            <div className="font-semibold text-[var(--text)] text-sm">{title}</div>
            <div className="text-xs text-[var(--text-muted)]">{subtitle}</div>
          </div>
        </Link>
      </TiltCard>
    </div>
  );
}

function ShortcutCard({ href, icon, label, sub }: { href: string; icon: string; label: string; sub: string; accent: string }) {
  return (
    <TiltCard className="card overflow-hidden flex flex-col items-center gap-1.5 py-3 cursor-pointer text-center" intensity={7}>
      <Link href={href} className="flex flex-col items-center gap-1.5 w-full" style={{ margin: '-20px', padding: '20px' }}>
        <div className="text-2xl animate-float-icon">{icon}</div>
        <div className="font-semibold text-[var(--text)] text-xs">{label}</div>
        <div className="text-xs text-[var(--text-muted)]">{sub}</div>
      </Link>
    </TiltCard>
  );
}
