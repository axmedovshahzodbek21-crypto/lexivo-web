import type { ReactNode } from 'react';
import ClassShellNav from '@/components/ClassShellNav';

export default function ClassLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { id: string };
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex-1 pb-16 sm:pb-0 sm:pl-16">
        {children}
      </div>
      <ClassShellNav classId={params.id} />
    </div>
  );
}
