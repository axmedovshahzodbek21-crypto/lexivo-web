import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
import Navigation from '@/components/Navigation';
import AchievementToast from '@/components/AchievementToast';
import LevelUpOverlay from '@/components/LevelUpOverlay';
import KeyboardHelp from '@/components/KeyboardHelp';
import DataLoader from '@/components/DataLoader';
import GlobalKeyboardHandler from '@/components/GlobalKeyboardHandler';
import ThemeProvider from '@/components/ThemeProvider';
import NotificationScheduler from '@/components/NotificationScheduler';
import PomodoroWidget from '@/components/PomodoroWidget';
import { AuthProvider } from '@/lib/auth-context';
import SyncProvider from '@/components/SyncProvider';
import OneSignalProvider from '@/components/OneSignalProvider';

export const metadata: Metadata = {
  title: 'Lexivo – Vocabulary Learning',
  description: 'Master English vocabulary with SRS, quizzes, flashcards, and built-in Uzbek translations.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Lexivo' },
  icons: { apple: '/icon-192.png' },
};

export const viewport: Viewport = {
  themeColor: '#6C63FF',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.variable}>
        <AuthProvider>
        <SyncProvider />
        <ThemeProvider />
        <NotificationScheduler />
        <DataLoader />
        <GlobalKeyboardHandler />
        <div className="md:flex md:min-h-screen">
          <Navigation />
          <div className="flex-1 min-w-0">
            <div className="max-w-2xl mx-auto">
              <main className="min-h-screen pb-20 md:pb-8">
                {children}
              </main>
            </div>
          </div>
        </div>
        <PomodoroWidget />
        <OneSignalProvider />
        <AchievementToast />
        <LevelUpOverlay />
        <KeyboardHelp />
        </AuthProvider>
      </body>
    </html>
  );
}
