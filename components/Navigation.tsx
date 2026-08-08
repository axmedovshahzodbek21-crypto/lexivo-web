'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getSettings, getXP, getProfilePic, getProfilePicUrl } from '@/lib/storage';
import { getLevelInfo } from '@/lib/gamification';
import { useTranslation } from '@/lib/useTranslation';
import { LEVEL_COLORS, LEVEL_COLORS_FALLBACK } from '@/lib/colors';

const NAV_HREFS = [
  { href: '/',             icon: '🏠', key: 'home'        },
  { href: '/learn',        icon: '📖', key: 'learn'       },
  { href: '/reading',      icon: '📰', key: 'reading'     },
  { href: '/srs',          icon: '🔄', key: 'review'      },
  { href: '/search',       icon: '🔍', key: 'search'      },
  { href: '/progress',     icon: '📊', key: 'progress'    },
  { href: '/matching',     icon: '🎯', key: 'matching'    },
  { href: '/leaderboard',  icon: '🏆', key: 'leaderboard' },
  { href: '/classes',      icon: '👩‍🏫', key: 'classes'     },
  { href: '/library',      icon: '📚', key: 'library'     },
] as const;

const MOBILE_NAV_HREFS = NAV_HREFS.slice(0, 5);

export default function Navigation() {
  const pathname  = usePathname();
  const t = useTranslation();
  const isActive  = (href: string) => href === '/' ? pathname === '/' : pathname.startsWith(href);

  const [name, setName]         = useState('Learner');
  const [xp, setXp]             = useState(0);
  const [profilePic, setProfilePic] = useState<string | null>(null);

  useEffect(() => {
    const s = getSettings();
    setName(s.name);
    setXp(getXP());
    setProfilePic(getProfilePicUrl() ?? getProfilePic());
  }, [pathname]);

  const levelInfo  = getLevelInfo(xp);
  const initial    = name.charAt(0).toUpperCase();
  const levelColor = LEVEL_COLORS[levelInfo.level] ?? LEVEL_COLORS_FALLBACK;

  // Hide when inside a class room (/classes/[id] or /classes/[id]/*)
  if (/^\/classes\/[^/]+(\/|$)/.test(pathname)) return null;

  return (
    <>
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

      {/* ── Desktop: compact icon sidebar ── */}
      <aside className="hidden sm:flex shrink-0 sticky top-0 h-screen w-16 z-30 flex-col items-center py-4 gap-1 bg-[var(--surface)] border-r border-[var(--border)]">
        {/* Brand mark */}
        <Link
          href="/"
          title="Lexivo"
          className="flex items-center justify-center w-10 h-10 rounded-xl mb-3 text-base font-black text-white shrink-0"
          style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-light))' }}
        >
          L
        </Link>

        {/* Nav links — icons only */}
        {NAV_HREFS.map(({ href, icon, key }) => {
          const active = isActive(href);
          const label = t.nav[key];
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={`flex items-center justify-center w-12 h-12 rounded-xl text-xl transition-colors ${
                active
                  ? 'bg-[var(--primary-bg)] text-[var(--primary)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)]'
              }`}
            >
              {icon}
            </Link>
          );
        })}

        {/* Profile avatar at bottom */}
        <div className="flex-1" />
        <Link
          href="/profile"
          title={name}
          className="flex items-center justify-center w-10 h-10 rounded-full overflow-hidden shrink-0 text-white text-sm font-black transition-all hover:ring-2 hover:ring-[var(--primary)] hover:ring-offset-2 hover:ring-offset-[var(--surface)]"
          style={{
            background: profilePic ? undefined : `linear-gradient(135deg, var(--primary), ${levelColor})`,
            boxShadow: `0 0 0 2px var(--primary)`,
          }}
        >
          {profilePic
            ? <img src={profilePic} alt="Profile" className="w-full h-full object-cover" />
            : initial}
        </Link>
      </aside>
    </>
  );
}
