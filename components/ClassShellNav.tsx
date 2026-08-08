'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

const BASE_ITEMS = [
  { seg: 'home',        icon: '🏠', label: 'Home'     },
  { seg: 'words',       icon: '📖', label: 'Words'    },
  { seg: 'leaderboard', icon: '🏆', label: 'Ranks'    },
  { seg: 'homework',    icon: '📋', label: 'Homework' },
];

const TEACHER_ITEM = { seg: '', icon: '📊', label: 'Dashboard' };

export default function ClassShellNav({ classId }: { classId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [isTeacher, setIsTeacher] = useState(false);
  const [className, setClassName] = useState('');
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('classes')
      .select('teacher_id, name')
      .eq('id', classId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setIsTeacher(data.teacher_id === user.id);
          setClassName((data as any).name ?? '');
        }
      });
  }, [classId, user]);

  const items = isTeacher ? [...BASE_ITEMS, TEACHER_ITEM] : BASE_ITEMS;

  const isActive = (seg: string) => {
    const full = `/classes/${classId}${seg ? `/${seg}` : ''}`;
    return seg === '' ? pathname === full : pathname.startsWith(full);
  };

  // Two-step back: subpage → class home → classes list
  const classHomeHref = `/classes/${classId}/home`;
  const classRootHref = `/classes/${classId}`;
  const atClassTop = pathname === classHomeHref || pathname === classRootHref;

  const handleBackClick = () => {
    if (atClassTop) {
      setShowLeaveConfirm(true);
    } else {
      router.push(classHomeHref);
    }
  };

  return (
    <>
      {/* Mobile bottom bar */}
      <nav
        className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--surface)] border-t border-[var(--border)] flex justify-around items-center py-2 shadow-lg"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {items.map(({ seg, icon, label }) => {
          const active = isActive(seg);
          const href = `/classes/${classId}${seg ? `/${seg}` : ''}`;
          return (
            <Link
              key={seg || 'dashboard'}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 min-w-[48px] ${active ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'}`}
            >
              <span className="text-xl leading-none">{icon}</span>
              <span className="text-[10px] font-semibold">{label}</span>
              {active && <span className="w-1 h-1 rounded-full bg-[var(--primary)] mt-0.5" />}
            </Link>
          );
        })}
      </nav>

      {/* Desktop sidebar — styled like main Navigation */}
      <aside className="hidden sm:flex fixed left-0 top-0 bottom-0 w-56 z-50 flex-col p-3">
        <div className="sidebar-glass flex flex-col w-full h-full rounded-2xl overflow-y-auto">

          {/* Header: back arrow + class name */}
          <div className="px-5 pt-6 pb-4 flex items-start gap-3">
            <button
              onClick={handleBackClick}
              title={atClassTop ? 'Back to classes' : 'Back to class home'}
              className="mt-1 shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs text-[var(--text-muted)] hover:text-white hover:bg-[var(--primary)] transition-all duration-200"
            >
              ←
            </button>
            <div className="min-w-0">
              <span
                className="text-2xl font-black tracking-tight"
                style={{
                  background: 'linear-gradient(135deg, var(--primary), var(--primary-light))',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Class
              </span>
              {className && (
                <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                  {className}
                </div>
              )}
            </div>
          </div>

          {/* Nav links with icon + label */}
          <nav className="flex-1 px-3 space-y-0.5">
            {items.map(({ seg, icon, label }) => {
              const active = isActive(seg);
              const href = `/classes/${classId}${seg ? `/${seg}` : ''}`;
              return (
                <Link
                  key={seg || 'dashboard'}
                  href={href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-sm font-semibold ${
                    active
                      ? 'text-white'
                      : 'text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary-bg)]'
                  }`}
                  style={active ? {
                    background: 'linear-gradient(135deg, var(--primary), var(--primary-light))',
                    boxShadow: '0 4px 16px rgba(108,99,255,0.38)',
                  } : undefined}
                >
                  <span className={`transition-transform duration-200 ${active ? 'text-xl scale-110' : 'text-lg'}`}>
                    {icon}
                  </span>
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Exit button at bottom */}
          <div className="px-3 pb-4 pt-3 border-t border-[var(--border)]">
            <button
              onClick={handleBackClick}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--danger)] transition-colors"
            >
              <span>🚪</span>
              <span>{atClassTop ? 'Exit class' : 'Back to class home'}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Leave-class confirm modal */}
      {showLeaveConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowLeaveConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-5 space-y-4"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0">🚪</span>
              <div>
                <p className="font-bold text-[var(--text)]">Exit this class?</p>
                <p className="text-sm text-[var(--text-muted)] mt-1">
                  {isTeacher
                    ? "You'll return to your classes list."
                    : "You'll return to your joined classes list — you'll stay enrolled in this class."}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[var(--text)]"
                style={{ background: 'var(--surface-2)' }}
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowLeaveConfirm(false); router.push(isTeacher ? '/classes/created' : '/classes/joined'); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: 'var(--primary)' }}
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
