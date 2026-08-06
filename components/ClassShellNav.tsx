'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  const { user } = useAuth();
  const [isTeacher, setIsTeacher] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('classes')
      .select('teacher_id')
      .eq('id', classId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setIsTeacher(data.teacher_id === user.id);
      });
  }, [classId, user]);

  const items = isTeacher ? [...BASE_ITEMS, TEACHER_ITEM] : BASE_ITEMS;

  const isActive = (seg: string) => {
    const full = `/classes/${classId}${seg ? `/${seg}` : ''}`;
    return seg === '' ? pathname === full : pathname.startsWith(full);
  };

  // The top arrow is a two-step back: from any class subpage it first drops
  // you at this class's home, and only from there does it leave the class
  // entirely (back to /classes). Prevents an accidental single click from
  // kicking you out of the class you're working in.
  const classHomeHref = `/classes/${classId}/home`;
  const classRootHref = `/classes/${classId}`;
  const atClassTop = pathname === classHomeHref || pathname === classRootHref;
  const backHref = atClassTop ? '/classes' : classHomeHref;
  const backTitle = atClassTop ? 'Back to classes' : 'Back to class home';

  return (
    <>
      {/* Mobile bottom bar */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--surface)] border-t border-[var(--border)] flex justify-around items-center py-2 shadow-lg"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {items.map(({ seg, icon, label }) => {
          const active = isActive(seg);
          const href = `/classes/${classId}${seg ? `/${seg}` : ''}`;
          return (
            <Link
              key={seg || 'dashboard'}
              href={href}
              className="flex flex-col items-center gap-0.5 px-3 py-1 min-w-[48px]"
            >
              <span className="text-xl leading-none">{icon}</span>
              <span className={`text-[10px] font-semibold ${active ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'}`}>
                {label}
              </span>
              {active && <span className="w-1 h-1 rounded-full bg-[var(--primary)] mt-0.5" />}
            </Link>
          );
        })}
      </nav>

      {/* Desktop sidebar */}
      <nav className="hidden sm:flex fixed left-0 top-0 bottom-0 w-16 z-50 flex-col items-center py-4 gap-1 bg-[var(--surface)] border-r border-[var(--border)]">
        <Link href={backHref} className="flex items-center justify-center w-10 h-10 rounded-xl text-[var(--text-muted)] hover:bg-[var(--surface-2)] mb-3 text-lg" title={backTitle}>
          ←
        </Link>
        {items.map(({ seg, icon, label }) => {
          const active = isActive(seg);
          const href = `/classes/${classId}${seg ? `/${seg}` : ''}`;
          return (
            <Link
              key={seg || 'dashboard'}
              href={href}
              title={label}
              className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl text-xl transition-colors ${
                active
                  ? 'bg-[var(--primary-bg)] text-[var(--primary)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)]'
              }`}
            >
              {icon}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
