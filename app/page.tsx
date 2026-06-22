'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/useTranslation';
import { useAppStore } from '@/lib/store';
import { getWordOfDay } from '@/lib/data';
import { getStreak, getXP, getTodayXP, getTodayLearnedCount, getDueWords, getLearnedWords, getSettings, isOnboarded, getFreezes, checkAndGrantWeeklyFreeze, getImportedWords, getLastStudyDate, localDateStr } from '@/lib/storage';
import { getLevelInfo } from '@/lib/gamification';
import { speak } from '@/lib/speech';
import { getTheme, toggleTheme, type Theme } from '@/lib/theme';
import type { WordItem, UserSettings } from '@/lib/types';
import XpModal from '@/components/XpModal';
import TiltCard from '@/components/TiltCard';

const COLLECTION_META: Record<string, { icon: string; color: string; desc: string }> = {
  '30 Days of Powerful Words': { icon: '🏆', color: 'var(--primary)', desc: 'Essential IELTS vocabulary by topic' },
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
  const [settings, setSettings] = useState<UserSettings>({ name: 'Learner', dailyGoal: 10, languageLevel: 'B1', defaultAccent: 'us', autoPlayOnReveal: true, sessionSize: 20, fontSize: 'normal', studyOrder: 'random', quizDirection: 'word-to-uz', reduceMotion: false, uiLanguage: 'en', showOnLeaderboard: true });
  const [freezes, setFreezes] = useState(0);
  const [streakRisk, setStreakRisk] = useState<'safe' | 'at-risk' | 'freeze-saves'>('safe');
  const [importedCount, setImportedCount] = useState(0);
  const [wodRevealed, setWodRevealed] = useState(false);
  const [theme, setThemeState] = useState<Theme>('light');
  const [showXpModal, setShowXpModal] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (!isOnboarded()) { router.replace('/onboarding'); return; }
    checkAndGrantWeeklyFreeze();
    const currentStreak = getStreak();
    const currentFreezes = getFreezes();
    setStreak(currentStreak);
    setFreezes(currentFreezes);

    if (currentStreak > 0) {
      const today = localDateStr();
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
      const yStr = localDateStr(yesterday);
      const twoDaysAgo = new Date(); twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const tdStr = localDateStr(twoDaysAgo);
      const last = getLastStudyDate();
      if (last === today) {
        setStreakRisk('safe');
      } else if (last === tdStr) {
        setStreakRisk(currentFreezes > 0 ? 'freeze-saves' : 'at-risk');
      } else if (last === yStr) {
        setStreakRisk('safe');
      } else {
        setStreakRisk('at-risk');
      }
    }
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
      setSettings(getSettings());
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
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
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

      {/* ── Review reminder banner ── */}
      {dueCount > 0 && (
        <Link href="/srs" className="flex items-center gap-4 p-4 rounded-2xl border-2 transition-colors hover:opacity-90"
          style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.35)' }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
            style={{ background: 'rgba(239,68,68,0.15)' }}>🔔</div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm" style={{ color: 'var(--danger)' }}>
              {dueCount} {dueCount === 1 ? 'word' : 'words'} due for review!
            </div>
            <div className="text-xs mt-0.5 text-[var(--text-muted)]">Complete your reviews for best results.</div>
          </div>
          <span className="text-sm font-bold flex-shrink-0" style={{ color: 'var(--danger)' }}>→</span>
        </Link>
      )}

      {/* ── Collections (most important, lifted to top) ── */}
      <div>
        <h2 className="font-semibold text-[var(--text)] text-base mb-3">{t.home.collections}</h2>
        <div className="space-y-3">
          {/* My Words — always shown so new users can discover import */}
          <TiltCard className="card overflow-hidden hover:border-[var(--primary)] transition-colors" intensity={6}>
            <Link href="/my-words" className="flex items-center gap-4" style={{ margin: '-20px', padding: '20px' }}>
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
            const meta = COLLECTION_META[col.name] ?? { icon: '📖', color: 'var(--primary)', desc: col.description };
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
          <StatCard icon="⚡" value={xp} label={t.home.totalXp} color="var(--primary)" glow />
        </button>
        <Link href="/progress">
          <StatCard icon="📚" value={learnedCount} label={t.home.words} color="var(--success)" />
        </Link>
      </div>

      {showXpModal && <XpModal xp={xp} onClose={() => setShowXpModal(false)} />}

      {/* Daily goal — prominent */}
      <TiltCard className="card" intensity={3}>
        <div className="flex items-center gap-4">
          {/* Ring */}
          <div className="relative shrink-0" style={{ width: 64, height: 64 }}>
            <svg width="64" height="64" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="32" cy="32" r="26" fill="none" stroke="var(--border)" strokeWidth="6" />
              <circle
                cx="32" cy="32" r="26" fill="none"
                stroke={dailyProgress >= 100 ? 'var(--success)' : 'var(--primary)'}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${Math.min(dailyProgress, 100) / 100 * 163.4} 163.4`}
                style={{ transition: 'stroke-dasharray 0.5s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-black" style={{ color: dailyProgress >= 100 ? 'var(--success)' : 'var(--primary)' }}>
                {dailyProgress >= 100 ? '✓' : todayCount}
              </span>
            </div>
          </div>
          {/* Text */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-[var(--text)]">{todayCount}</span>
              <span className="text-sm text-[var(--text-muted)] font-medium">/ {settings.dailyGoal} {t.home.dailyGoal.toLowerCase()}</span>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-[var(--border)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(dailyProgress, 100)}%`, background: dailyProgress >= 100 ? 'var(--success)' : 'var(--primary)' }}
              />
            </div>
            <p className="text-xs mt-1" style={{ color: dailyProgress >= 100 ? 'var(--success)' : 'var(--text-muted)' }}>
              {dailyProgress >= 100 ? `${t.home.goalReached} · ${todayXp} XP today` : `${todayXp} XP today · ${Math.max(0, settings.dailyGoal - todayCount)} words to go`}
            </p>
          </div>
        </div>
      </TiltCard>

      {/* Streak at risk warning */}
      {streakRisk === 'freeze-saves' && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium"
          style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.4)', color: '#B45309' }}>
          <span className="text-base">⚠️</span>
          <span>Study today — a 🧊 freeze will protect your {streak}-day streak!</span>
        </div>
      )}
      {streakRisk === 'at-risk' && streak > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)', color: '#DC2626' }}>
          <span className="text-base">🔥</span>
          <span>Your {streak}-day streak is at risk! Study something today.</span>
        </div>
      )}

      {/* Streak freeze indicator */}
      <div
        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium"
        style={{
          background: freezes > 0 ? 'rgba(99,179,237,0.12)' : 'rgba(148,163,184,0.08)',
          border: `1px solid ${freezes > 0 ? 'rgba(99,179,237,0.35)' : 'rgba(148,163,184,0.2)'}`,
          color: freezes > 0 ? '#3B82F6' : 'var(--text-muted)',
        }}
      >
        <span className="text-base">🧊</span>
        <span className="flex-1">
          {freezes === 0
            ? 'No streak freezes — earn one by studying 7 days in a row'
            : freezes === 1 ? t.home.freezeSingle : t.home.freezeMulti(freezes)}
        </span>
        {freezes > 0 && (
          <span className="text-xs opacity-60">auto-applies if you miss a day</span>
        )}
      </div>

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

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <ActionCard href="/learn"         icon="📖" title={t.home.learnTitle}     subtitle={t.home.learnSub}          color="var(--primary)" depthClass="depth-in-1" />
        <ActionCard href="/flashcards"    icon="🃏" title={t.home.flashcardsTitle} subtitle={t.home.flashcardsSub}     color="#FF6B35" depthClass="depth-in-2" />
        <ActionCard
          href="/srs"
          icon="🔄"
          title={t.home.srsTitle}
          subtitle={dueCount > 0 ? t.home.srsDue(dueCount) : t.home.srsAllCaughtUp}
          color={dueCount > 0 ? 'var(--danger)' : 'var(--success)'}
          badge={dueCount > 0 ? String(dueCount) : undefined}
          depthClass="depth-in-3"
        />
        <ActionCard href="/quiz"          icon="❓" title={t.home.quizTitle}       subtitle={t.home.quizSub}           color="var(--warning)" depthClass="depth-in-4" />
        <ActionCard href="/pronunciation" icon="🎙️" title={t.home.pronounceTitle}  subtitle={t.home.pronounceSub}      color="#8B5CF6" depthClass="depth-in-5" />
        <ActionCard href="/matching"      icon="🎯" title={t.home.matchTitle}       subtitle={t.home.matchSub}          color="#EC4899" depthClass="depth-in-6" />
        <ActionCard href="/pomodoro"      icon="🍅" title={t.home.pomodoroTitle}    subtitle={t.home.pomodoroSub}       color="var(--danger)" depthClass="depth-in-7" />
        <ActionCard href="/leaderboard"   icon="🏆" title="Leaderboard"             subtitle="See top learners"          color="var(--warning)" depthClass="depth-in-8" />
      </div>

      {/* Word of the Day */}
      {wod && (
        <TiltCard className="card" intensity={3}>
          <div className="flex items-center justify-between mb-3">
            <span className="badge">{t.home.wordOfDay}</span>
            <button
              onClick={() => speak(wod.word)}
              className="w-8 h-8 rounded-full bg-[var(--primary-bg)] flex items-center justify-center text-sm hover:bg-[var(--primary)] hover:text-white transition-colors"
              aria-label="Listen to pronunciation"
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
        <ShortcutCard href="/lists"        icon="📋" label={t.home.listsTitle}   sub={t.home.listsSub}    accent="#8B5CF6"        />
        <ShortcutCard href="/grammar-tips" icon="📚" label={t.home.grammarTitle} sub={t.home.grammarSub}  accent="var(--success)" />
        <ShortcutCard href="/classes"      icon="👩‍🏫" label={t.home.classesTitle} sub={t.home.classesSub} accent="#0EA5E9"        />
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
