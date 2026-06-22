'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getSettings, getStreak, getXP, getProfilePic, getProfilePicUrl } from '@/lib/storage';
import { getLevelInfo } from '@/lib/gamification';
import { useAuth } from '@/lib/auth-context';
import { useTranslation } from '@/lib/useTranslation';
import { LEVEL_COLORS, LEVEL_COLORS_FALLBACK } from '@/lib/colors';
import SyncStatusBadge from './SyncStatusBadge';

const NAV_HREFS = [
  { href: '/',             icon: '🏠', key: 'home'        },
  { href: '/learn',        icon: '📖', key: 'learn'       },
  { href: '/srs',          icon: '🔄', key: 'review'      },
  { href: '/search',       icon: '🔍', key: 'search'      },
  { href: '/progress',     icon: '📊', key: 'progress'    },
  { href: '/matching',     icon: '🎯', key: 'matching'    },
  { href: '/leaderboard',  icon: '🏆', key: 'leaderboard' },
  { href: '/classes',      icon: '👩‍🏫', key: 'classes'     },
] as const;

// Mobile bottom bar: 5 core items only — Matching & Leaderboard are on the home page
const MOBILE_NAV_HREFS = NAV_HREFS.slice(0, 5);


export default function Navigation() {
  const pathname  = usePathname();
  const router    = useRouter();
  const { user, signOut } = useAuth();
  const t = useTranslation();
  const isActive  = (href: string) => href === '/' ? pathname === '/' : pathname.startsWith(href);

  const [name, setName]           = useState('Learner');
  const [langLevel, setLangLevel] = useState('B1');
  const [streak, setStreak]       = useState(0);
  const [xp, setXp]               = useState(0);
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('lexivo_sidebar_open');
    if (stored === 'false') setSidebarOpen(false);
  }, []);

  const toggleSidebar = () => {
    const next = !sidebarOpen;
    setSidebarOpen(next);
    localStorage.setItem('lexivo_sidebar_open', String(next));
  };

  useEffect(() => {
    const refresh = () => {
      const s = getSettings();
      setName(s.name);
      setLangLevel(s.languageLevel);
      setStreak(getStreak());
      setXp(getXP());
      setProfilePic(getProfilePicUrl() ?? getProfilePic());
    };
    refresh();
    window.addEventListener('lexivo-sync', refresh);
    return () => window.removeEventListener('lexivo-sync', refresh);
  }, [pathname]);

  const levelInfo  = getLevelInfo(xp);
  const initial    = name.charAt(0).toUpperCase();
  const levelColor = LEVEL_COLORS[levelInfo.level] ?? LEVEL_COLORS_FALLBACK;

  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
  };

  return (
    <>
      {/* ── Mobile: sync status pill (top-right) ── */}
      <div className="sm:hidden fixed top-3 right-3 z-50">
        <SyncStatusBadge />
      </div>

      {/* ── Mobile: fixed bottom tab bar ── */}
      <nav
        className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--surface)] border-t border-[var(--border)] flex justify-around items-center py-2 px-1 shadow-lg"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {MOBILE_NAV_HREFS.map(({ href, icon, key }) => {
          const active = isActive(href);
          const label = t.nav[key];
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-xl transition-all ${active ? 'text-[var(--primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'}`}
            >
              <span className={`text-xl transition-transform ${active ? 'scale-110' : ''}`}>{icon}</span>
              <span className={`text-xs ${active ? 'font-semibold' : 'font-medium'}`}>{label}</span>
              {active && <div className="w-1 h-1 rounded-full bg-[var(--primary)]" />}
            </Link>
          );
        })}
      </nav>

      {/* ── Desktop: floating expand button (visible only when sidebar is hidden) ── */}
      <button
        onClick={toggleSidebar}
        title="Show sidebar"
        tabIndex={sidebarOpen ? -1 : 0}
        className={`hidden sm:flex fixed top-4 left-2 z-50 w-7 h-7 items-center justify-center rounded-lg bg-[var(--surface)] border border-[var(--border)] shadow-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-opacity duration-300 ${sidebarOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      >
        ›
      </button>

      {/* ── Desktop: persistent left sidebar ── */}
      <aside className={`hidden sm:flex flex-col shrink-0 bg-[var(--surface)] sticky top-0 h-screen z-30 transition-[width] duration-300 ${sidebarOpen ? 'w-52 border-r border-[var(--border)] overflow-y-auto' : 'w-0 overflow-hidden'}`}>
        {/* Brand + collapse button */}
        <div className="px-5 pt-6 pb-4 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="text-2xl font-black tracking-tight" style={{ color: 'var(--primary)' }}>Lexivo</span>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{t.sidebar.tagline}</div>
          </div>
          <button
            onClick={toggleSidebar}
            title="Hide sidebar"
            className="mt-1 shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-xs text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] border border-[var(--border)] transition-colors"
          >
            ‹
          </button>
        </div>

        {/* Sync status */}
        <div className="px-5 pb-3">
          <SyncStatusBadge />
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 space-y-0.5">
          {NAV_HREFS.map(({ href, icon, key }) => {
            const active = isActive(href);
            const label = t.nav[key];
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${
                  active
                    ? 'bg-[var(--primary-bg)] text-[var(--primary)]'
                    : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'
                }`}
              >
                <span className="text-lg">{icon}</span>
                <span>{label}</span>
                {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />}
              </Link>
            );
          })}

        </nav>

        {/* ── Profile block ── */}
        <div className="px-3 pb-4 pt-3 border-t border-[var(--border)]">
          <Link
            href="/profile"
            className="block rounded-2xl p-3 transition-colors hover:bg-[var(--surface-2)] group"
          >
            {/* Top row: avatar + name + gear */}
            <div className="flex items-center gap-2.5 mb-3">
              <div
                className="w-9 h-9 rounded-full overflow-hidden shrink-0 shadow-sm flex items-center justify-center text-white text-sm font-black"
                style={{ background: profilePic ? undefined : `linear-gradient(135deg, var(--primary), ${levelColor})` }}
              >
                {profilePic
                  ? <img src={profilePic} alt="Profile" className="w-full h-full object-cover" />
                  : initial}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[var(--text)] truncate leading-tight">{name}</p>
                <span
                  className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full mt-0.5"
                  style={{ background: `${levelColor}22`, color: levelColor }}
                >
                  {langLevel}
                </span>
              </div>
              <span className="text-base text-[var(--text-muted)] group-hover:text-[var(--text)] transition-colors shrink-0">⚙️</span>
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-3 mb-2.5">
              <div className="flex items-center gap-1">
                <span className="text-sm">🔥</span>
                <span className="text-xs font-bold text-[var(--text)]">{streak}</span>
                <span className="text-[10px] text-[var(--text-muted)]">{t.sidebar.day}</span>
              </div>
              <div className="w-px h-3 bg-[var(--border)]" />
              <div className="flex items-center gap-1">
                <span className="text-sm">⚡</span>
                <span className="text-xs font-bold text-[var(--text)]">{xp}</span>
                <span className="text-[10px] text-[var(--text-muted)]">XP</span>
              </div>
            </div>

            {/* XP progress bar */}
            <div>
              <div className="h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${levelInfo.progress}%`,
                    background: `linear-gradient(90deg, var(--primary), ${levelColor})`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] font-bold" style={{ color: levelColor }}>
                  {levelInfo.level}
                </span>
                {levelInfo.next && (
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {levelInfo.xpToNext} XP → {levelInfo.next}
                  </span>
                )}
              </div>
            </div>
          </Link>

          {/* Auth row */}
          {user ? (
            <div className="mt-2 space-y-1">
              <div className="px-3 py-1.5 rounded-xl bg-[var(--surface-2)]">
                <p className="text-[10px] text-[var(--text-muted)] font-medium">{t.sidebar.signedInAs}</p>
                <p className="text-xs font-bold text-[var(--text)] truncate">{user.email}</p>
              </div>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--danger)] transition-colors"
              >
                <span>🚪</span>
                <span>{t.sidebar.signOut}</span>
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="mt-2 w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--primary-bg)] hover:text-[var(--primary)] transition-colors"
            >
              <span>🔑</span>
              <span>{t.sidebar.signIn}</span>
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}
