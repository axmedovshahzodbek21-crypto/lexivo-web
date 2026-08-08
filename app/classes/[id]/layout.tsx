import type { ReactNode } from 'react';
import ClassShellNav from '@/components/ClassShellNav';

export default async function ClassLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex-1 pb-16 sm:pb-0 sm:pl-56">
        {children}
      </div>
      <ClassShellNav classId={id} />
    </div>
  );
}
