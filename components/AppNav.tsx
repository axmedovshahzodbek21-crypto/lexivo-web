'use client';
import { usePathname, useSearchParams } from 'next/navigation';
import Navigation from './Navigation';
import ClassShellNav from './ClassShellNav';

// Shared study routes that can be entered either from a personal collection
// or from inside a class (via ?classId=...). When launched from a class we
// keep the class sidebar visible instead of swapping to the main app nav,
// so the session doesn't feel like it left the classroom.
const CLASS_STUDY_ROUTES = new Set(['/learn', '/flashcards', '/quiz', '/matching']);

export default function AppNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const classId = searchParams.get('classId');

  const inClassRoom = /^\/classes\/[^/]+(\/|$)/.test(pathname);

  if (inClassRoom) {
    // app/classes/[id]/layout.tsx renders its own ClassShellNav around these children.
    return <>{children}</>;
  }

  if (classId && CLASS_STUDY_ROUTES.has(pathname)) {
    return (
      <div className="sm:min-h-screen">
        <ClassShellNav classId={classId} />
        <div className="pb-16 sm:pb-0 sm:pl-56">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="sm:flex sm:min-h-screen">
      <Navigation />
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  );
}
