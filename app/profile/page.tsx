'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import {
  getSettings, getStreak, getXP, getTodayXP, getTodayLearnedCount,
  getLearnedWords, getSRSWords, getDueWords, getUnlockedAchievements,
  getUnitProgress, getProfilePic, saveProfilePic, removeProfilePic,
  getProfilePicUrl, saveProfilePicUrl, removeProfilePicUrl,
} from '@/lib/storage';
import { getLevelInfo, ALL_ACHIEVEMENTS } from '@/lib/gamification';
import type { UserSettings } from '@/lib/types';
import { useRef } from 'react';
import XpModal from '@/components/XpModal';
import TiltCard from '@/components/TiltCard';
import { useTranslation } from '@/lib/useTranslation';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

async function compressImage(file: File, maxSize = 200): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.onerror = reject;
      img.src = e.target!.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const LEVEL_COLORS: Record<string, string> = {
  Beginner:             '#2ECC71',
  Elementary:           '#27AE60',
  Intermediate:         '#3498DB',
  'Upper-Intermediate': '#2980B9',
  Advanced:             '#9B59B6',
  Master:               '#F39C12',
};

const CEFR_LABELS: Record<string, string> = {
  A1: 'Beginner', A2: 'Elementary', B1: 'Intermediate',
  B2: 'Upper-Intermediate', C1: 'Advanced', C2: 'Mastery',
};

export default function ProfilePage() {
  const router = useRouter();
  const { collections, collectionsLoaded } = useAppStore();
  const { user, signOut } = useAuth();

  const [settings, setSettings] = useState<UserSettings>({
    name: 'Learner', dailyGoal: 10, languageLevel: 'B1', defaultAccent: 'us',
    autoPlayOnReveal: true, sessionSize: 20, fontSize: 'normal',
    studyOrder: 'random', quizDirection: 'word-to-uz', reduceMotion: false, uiLanguage: 'en', showOnLeaderboard: true,
  });
  const [streak, setStreak]           = useState(0);
  const [xp, setXp]                   = useState(0);
  const [todayXp, setTodayXp]         = useState(0);
  const [todayCount, setTodayCount]   = useState(0);
  const [learnedCount, setLearnedCount] = useState(0);
  const [srsCount, setSrsCount]       = useState(0);
  const [dueCount, setDueCount]       = useState(0);
  const [unlockedIds, setUnlockedIds] = useState<string[]>([]);
  const [profilePic, setProfilePic]   = useState<string | null>(null);
  const [showXpModal, setShowXpModal] = useState(false);
  const [passwordSent, setPasswordSent] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = () => {
      const s = getSettings();
      setSettings(s);
      setStreak(getStreak());
      setXp(getXP());
      setTodayXp(getTodayXP());
      setTodayCount(getTodayLearnedCount());
      setLearnedCount(getLearnedWords().length);
      setSrsCount(getSRSWords().length);
      setDueCount(getDueWords().length);
      setUnlockedIds(getUnlockedAchievements());
      setProfilePic(getProfilePicUrl() ?? getProfilePic());
    };
    load();
    window.addEventListener('lexivo-sync', load);
    return () => window.removeEventListener('lexivo-sync', load);
  }, []);

  async function handlePickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Keep base64 locally as offline fallback
    const base64 = await compressImage(file);
    saveProfilePic(base64);

    if (user) {
      const { error } = await supabase.storage
        .from('avatars')
        .upload(`${user.id}/avatar.jpg`, file, { upsert: true, contentType: file.type });
      if (!error) {
        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(`${user.id}/avatar.jpg`);
        const url = `${publicUrl}?t=${Date.now()}`;
        saveProfilePicUrl(url);
        await supabase.from('profiles').upsert({ id: user.id, avatar_url: url });
        setProfilePic(url);
      } else {
        setProfilePic(base64);
      }
    } else {
      setProfilePic(base64);
    }
    e.target.value = '';
  }

  async function handleRemovePhoto() {
    removeProfilePic();
    removeProfilePicUrl();
    if (user) {
      await supabase.storage.from('avatars').remove([`${user.id}/avatar.jpg`]);
      await supabase.from('profiles').upsert({ id: user.id, avatar_url: null });
    }
    setProfilePic(null);
  }

  async function handleSignOut() {
    await signOut();
    router.replace('/login');
  }

  async function handleChangePassword() {
    if (!user?.email) return;
    await supabase.auth.resetPasswordForEmail(user.email);
    setPasswordSent(true);
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    setDeleteError(null);
    const { error } = await supabase.rpc('delete_user');
    if (error) {
      setDeleteError(error.message);
      setDeleting(false);
      return;
    }
    await signOut();
    router.replace('/');
  }

  const t = useTranslation();
  const levelInfo  = getLevelInfo(xp);
  const levelColor = LEVEL_COLORS[levelInfo.level] ?? 'var(--primary)';
  const initial    = settings.name.charAt(0).toUpperCase();

  // Per-collection unit progress
  const collectionStats = collectionsLoaded
    ? collections
        .filter(c => !['A1', 'A2', 'B1', 'Advanced'].includes(c.name))
        .map(col => {
          const total = col.days.length;
          const learnDone    = col.days.filter(d => getUnitProgress(col.name, d.dayNumber).learnDone).length;
          const fullyDone    = col.days.filter(d => {
            const p = getUnitProgress(col.name, d.dayNumber);
            return p.learnDone && p.flashcardDone && p.quizDone;
          }).length;
          return { name: col.name, total, learnDone, fullyDone };
        })
    : [];

  const unlockedCount = unlockedIds.length;

  return (
    <div className="flex flex-col min-h-screen animate-fade-in pb-24">
      {/* Header bar */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
        <button
          onClick={() => router.back()}
          className="btn-icon text-lg"
          aria-label="Go back"
        >←</button>
        <h1 className="font-bold text-[var(--text)]">{t.profile.title}</h1>
        <Link
          href="/settings"
          className="w-9 h-9 rounded-full bg-[var(--primary-bg)] flex items-center justify-center text-lg"
          aria-label="Settings"
        >⚙️</Link>
      </div>

      <div className="p-4 space-y-4">

        {/* ── Hero card ── */}
        <TiltCard
          className="rounded-3xl p-5 overflow-hidden flex flex-col items-center text-center"
          style={{
            background: 'var(--surface)',
            border: `1px solid ${levelColor}40`,
            boxShadow: `0 4px 32px ${levelColor}18`,
          }}
          intensity={3}
          glare={false}
        >
          {/* Avatar — tap to change photo */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePickPhoto}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="relative mb-3 group"
            aria-label={t.profile.changePhoto}
          >
            <div
              className="w-20 h-20 rounded-full overflow-hidden shadow-lg border-4"
              style={{ borderColor: `${levelColor}50` }}
            >
              {profilePic ? (
                <img src={profilePic} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-white text-4xl font-black"
                  style={{ background: `linear-gradient(135deg, var(--primary), ${levelColor})` }}
                >
                  {initial}
                </div>
              )}
            </div>
            {/* Camera overlay */}
            <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center shadow-md text-sm group-hover:scale-110 transition-transform">
              📷
            </div>
          </button>
          {profilePic && (
            <button
              onClick={handleRemovePhoto}
              className="text-[var(--text-muted)] text-xs mb-1 hover:text-[var(--danger)] transition-colors"
            >
              {t.profile.removePhoto}
            </button>
          )}
          <h2 className="text-[var(--text)] text-2xl font-black">{settings.name}</h2>
          <div className="flex items-center gap-2 mt-1.5">
            <span
              className="text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ background: `${levelColor}20`, color: levelColor }}
            >
              {settings.languageLevel} · {CEFR_LABELS[settings.languageLevel] ?? ''}
            </span>
          </div>
          {/* Today's quick stats */}
          <div className="flex items-center gap-4 mt-4 text-sm">
            <div className="text-center">
              <div className="text-xl font-black text-[var(--text)]">{todayCount}</div>
              <div className="text-[11px] text-[var(--text-muted)]">{t.profile.today}</div>
            </div>
            <div className="w-px h-6 bg-[var(--border)]" />
            <div className="text-center">
              <div className="text-xl font-black text-[var(--text)]">+{todayXp}</div>
              <div className="text-[11px] text-[var(--text-muted)]">{t.profile.xpToday}</div>
            </div>
            <div className="w-px h-6 bg-[var(--border)]" />
            <div className="text-center">
              <div className="text-xl font-black text-[var(--text)]">🔥 {streak}</div>
              <div className="text-[11px] text-[var(--text-muted)]">{t.profile.streak}</div>
            </div>
          </div>
        </TiltCard>

        {/* ── Level & XP card ── */}
        <TiltCard className="card overflow-hidden hover:border-[var(--primary)] transition-colors animate-glow-pulse" intensity={4}>
          <button onClick={() => setShowXpModal(true)} className="w-full text-left" style={{ margin: '-20px', padding: '20px' }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider">{t.profile.currentLevel}</p>
                <p className="text-xl font-black text-[var(--text)] mt-0.5">⭐ {levelInfo.level}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-[var(--text-muted)]">{t.profile.totalXp}</p>
                <p className="text-2xl font-black" style={{ color: 'var(--primary)' }}>{xp}</p>
              </div>
            </div>
            <div className="h-3 bg-[var(--border)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${levelInfo.progress}%`,
                  background: `linear-gradient(90deg, var(--primary), ${levelColor})`,
                }}
              />
            </div>
            <div className="flex justify-between mt-1.5 text-xs text-[var(--text-muted)]">
              <span>{levelInfo.level}</span>
              {levelInfo.next
                ? <span><strong style={{ color: levelColor }}>{levelInfo.xpToNext} XP</strong> to {levelInfo.next} · tap for details</span>
                : <span className="text-[var(--success)] font-semibold">{t.profile.maxLevel}</span>
              }
            </div>
          </button>
        </TiltCard>

        {showXpModal && <XpModal xp={xp} onClose={() => setShowXpModal(false)} />}

        {/* ── Stats grid ── */}
        <div className="grid grid-cols-2 gap-3">
          <StatTile icon="📚" value={learnedCount} label={t.profile.wordsLearned} color="var(--primary)" />
          <StatTile icon="🔄" value={srsCount}     label={t.profile.inSrs}        color="#3498DB" />
          <StatTile
            icon="⏳"
            value={dueCount}
            label={t.profile.dueReview}
            color={dueCount > 0 ? 'var(--danger)' : 'var(--success)'}
            href="/srs"
          />
          <StatTile icon="🎯" value={settings.dailyGoal} label={t.profile.dailyGoal} color="var(--warning)" />
        </div>

        {/* ── Collections progress ── */}
        {collectionStats.length > 0 && (
          <div className="card space-y-4">
            <h3 className="font-bold text-[var(--text)] text-sm">{t.profile.collectionProgress}</h3>
            {collectionStats.map(col => {
              const pct = col.total ? Math.round((col.fullyDone / col.total) * 100) : 0;
              return (
                <div key={col.name}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-[var(--text)] truncate">{col.name}</p>
                    <span className="text-xs text-[var(--text-muted)] shrink-0 ml-2">
                      {t.profile.complete(col.fullyDone, col.total)}
                    </span>
                  </div>
                  <div className="h-2 bg-[var(--border)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        background: pct === 100 ? 'var(--success)' : 'var(--primary)',
                      }}
                    />
                  </div>
                  <div className="flex justify-between mt-0.5 text-[10px] text-[var(--text-muted)]">
                    <span>{t.profile.unitsStarted(col.learnDone)}</span>
                    <span>{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Achievements ── */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-[var(--text)] text-sm">{t.profile.achievements}</h3>
            <span className="text-xs font-semibold text-[var(--primary)]">
              {unlockedCount} / {ALL_ACHIEVEMENTS.length}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {ALL_ACHIEVEMENTS.map(a => {
              const unlocked = unlockedIds.includes(a.id);
              return (
                <div
                  key={a.id}
                  title={`${a.title}: ${a.description}`}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-2xl text-center transition-all ${
                    unlocked
                      ? 'bg-[var(--primary-bg)] border border-[var(--primary)]/30'
                      : 'bg-[var(--surface-2)] opacity-40'
                  }`}
                >
                  <span className="text-2xl">{a.icon}</span>
                  <span className={`text-[10px] font-semibold leading-tight ${unlocked ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'}`}>
                    {a.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Quick links ── */}
        <div className="grid grid-cols-2 gap-3">
          <TiltCard className="card flex items-center gap-3 overflow-hidden hover:border-[var(--primary)] transition-colors depth-in-1" intensity={5}>
            <Link href="/progress" className="flex items-center gap-3 w-full" style={{ margin: '-20px', padding: '20px' }}>
              <span className="text-2xl animate-float-icon">📊</span>
              <div>
                <p className="text-sm font-semibold text-[var(--text)]">Progress</p>
                <p className="text-xs text-[var(--text-muted)]">Charts & calendar</p>
              </div>
            </Link>
          </TiltCard>
          <TiltCard className="card flex items-center gap-3 overflow-hidden hover:border-[var(--primary)] transition-colors depth-in-2" intensity={5}>
            <Link href="/settings" className="flex items-center gap-3 w-full" style={{ margin: '-20px', padding: '20px' }}>
              <span className="text-2xl animate-float-icon">⚙️</span>
              <div>
                <p className="text-sm font-semibold text-[var(--text)]">Settings</p>
                <p className="text-xs text-[var(--text-muted)]">Goals & preferences</p>
              </div>
            </Link>
          </TiltCard>
          <TiltCard className={`card flex items-center gap-3 overflow-hidden transition-colors depth-in-4 ${dueCount > 0 ? 'border-[var(--danger)]' : 'hover:border-[var(--primary)]'}`} intensity={5}>
            <Link href="/srs" className="flex items-center gap-3 w-full" style={{ margin: '-20px', padding: '20px' }}>
              <span className="text-2xl animate-float-icon">🔄</span>
              <div>
                <p className="text-sm font-semibold text-[var(--text)]">SRS Review</p>
                <p className={`text-xs font-medium ${dueCount > 0 ? 'text-[var(--danger)]' : 'text-[var(--text-muted)]'}`}>
                  {dueCount > 0 ? t.profile.dueCount(dueCount) : t.profile.allCaughtUp}
                </p>
              </div>
            </Link>
          </TiltCard>
        </div>

        {/* ── Account ── */}
        {user ? (
          <div className="card space-y-2">
            <h3 className="font-bold text-[var(--text)] text-sm mb-3">{t.profile.account}</h3>

            {/* Email */}
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[var(--surface-2)]">
              <span className="text-base shrink-0">✉️</span>
              <div className="min-w-0">
                <p className="text-[10px] text-[var(--text-muted)] font-medium">{t.profile.signedInAs}</p>
                <p className="text-sm font-semibold text-[var(--text)] truncate">{user.email}</p>
              </div>
            </div>

            {/* Change password */}
            <button
              onClick={handleChangePassword}
              disabled={passwordSent}
              className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-[var(--border)] hover:bg-[var(--surface-2)] transition-colors text-[var(--text)] disabled:opacity-70"
            >
              <span>🔑</span>
              <span>{passwordSent ? '✓ Email sent' : t.profile.changePassword}</span>
            </button>
            {passwordSent && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 p-3 space-y-1.5 animate-fade-in">
                <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">Check your email</p>
                <p className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed">
                  We sent a password reset link to <strong>{user?.email}</strong>. Open that email and click the link — it will bring you back here to set a new password.
                </p>
                <p className="text-xs text-blue-500 dark:text-blue-500">Didn&apos;t get it? Check your spam folder or tap the button again.</p>
              </div>
            )}

            {/* Sign out */}
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-[var(--danger)] border border-[var(--danger)]/30 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
            >
              <span>🚪</span>
              <span>{t.profile.signOut}</span>
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="card flex items-center gap-3 px-4 py-3 hover:border-[var(--primary)] transition-colors"
          >
            <span className="text-xl">🔑</span>
            <div>
              <p className="text-sm font-semibold text-[var(--text)]">{t.profile.notSignedIn}</p>
              <p className="text-xs text-[var(--primary)]">{t.sidebar.signIn}</p>
            </div>
          </Link>
        )}

        {/* ── Danger Zone ── */}
        {user && (
          <div className="card border-red-200 dark:border-red-800/40 space-y-3">
            <h3 className="font-bold text-red-500 text-sm">{t.profile.dangerZone}</h3>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">{t.profile.deleteAccountWarning}</p>

            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-red-500 border border-red-200 dark:border-red-800/50 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
              >
                <span>🗑️</span>
                <span>{t.profile.deleteAccount}</span>
              </button>
            ) : (
              <div className="space-y-2">
                <label className="text-xs font-medium text-[var(--text-muted)]">{t.profile.deleteConfirmLabel}</label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  placeholder={t.profile.deleteConfirmPlaceholder}
                  className="w-full px-3 py-2 rounded-xl border border-red-300 dark:border-red-700 bg-transparent text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-red-400"
                />
                {deleteError && <p className="text-xs text-red-500">{deleteError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); setDeleteError(null); }}
                    className="flex-1 btn-outline py-2.5 text-sm"
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleteConfirmText !== 'DELETE' || deleting}
                    className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold disabled:opacity-40 hover:bg-red-600 transition-colors"
                  >
                    {deleting ? '…' : t.profile.deleteConfirmBtn}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

function StatTile({
  icon, value, label, color, href,
}: {
  icon: string; value: number; label: string; color: string; href?: string;
}) {
  const content = (
    <TiltCard className="card flex items-center gap-3 py-4" intensity={5}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 animate-float-icon" style={{ background: `${color}18` }}>
        {icon}
      </div>
      <div>
        <div className="text-xl font-black" style={{ color }}>{value}</div>
        <div className="text-xs text-[var(--text-muted)]">{label}</div>
      </div>
    </TiltCard>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}
