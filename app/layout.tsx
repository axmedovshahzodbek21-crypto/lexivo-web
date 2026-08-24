import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { headers } from 'next/headers';
import Script from 'next/script';
import './globals.css';
import AppNav from '@/components/AppNav';
import AchievementToast from '@/components/AchievementToast';
import LevelUpOverlay from '@/components/LevelUpOverlay';
import KeyboardHelp from '@/components/KeyboardHelp';
import DataLoader from '@/components/DataLoader';
import GlobalKeyboardHandler from '@/components/GlobalKeyboardHandler';
import ThemeProvider from '@/components/ThemeProvider';
import NotificationScheduler from '@/components/NotificationScheduler';
import PomodoroWidget from '@/components/PomodoroWidget';
import { AuthProvider } from '@/lib/auth-context';
import OneSignalProvider from '@/components/OneSignalProvider';
import HomeworkNotify from '@/components/HomeworkNotify';
import OfflineQueueFlusher from '@/components/OfflineQueueFlusher';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Lexivo – Vocabulary Learning',
  description: 'Master English vocabulary with SRS, quizzes, flashcards, and built-in Uzbek translations.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Lexivo' },
  icons: { apple: '/icon-192.png' },
};

export const viewport: Viewport = {
  themeColor: 'var(--primary)',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? '';

  return (
    <html lang="en">
      <body>
        <Script
          src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
          strategy="beforeInteractive"
          nonce={nonce}
        />
        <AuthProvider>
        <ThemeProvider />
        <NotificationScheduler />
        <DataLoader />
        <OfflineQueueFlusher />
        <GlobalKeyboardHandler />
        <Suspense fallback={
          <div className="sm:flex sm:min-h-screen">
            <div className="hidden sm:block w-[224px] shrink-0" />
            <div className="flex-1 min-w-0">
              <main className="min-h-screen pb-20 sm:pb-8">
                {children}
              </main>
            </div>
          </div>
        }>
          <AppNav>
            <main className="min-h-screen pb-20 sm:pb-8">
              {children}
            </main>
          </AppNav>
        </Suspense>
        <PomodoroWidget />
        <OneSignalProvider />
        <HomeworkNotify />
        <AchievementToast />
        <LevelUpOverlay />
        <KeyboardHelp />
        </AuthProvider>
      </body>
    </html>
  );
}