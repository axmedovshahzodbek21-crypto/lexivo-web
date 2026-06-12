'use client';
import { create } from 'zustand';
import type { WordCollection, Achievement } from './types';

type PomPhase = 'idle' | 'work' | 'break';

interface AppState {
  collections: WordCollection[];
  collectionsLoaded: boolean;
  setCollections: (c: WordCollection[]) => void;

  // Toast achievements
  pendingAchievements: Achievement[];
  pushAchievement: (a: Achievement) => void;
  popAchievement: () => void;

  // Level-up overlay
  pendingLevelUp: { level: string; xp: number } | null;
  setPendingLevelUp: (info: { level: string; xp: number }) => void;
  clearLevelUp: () => void;

  // Focus mode
  focusMode: boolean;
  setFocusMode: (v: boolean) => void;

  // Keyboard shortcut overlay
  showShortcuts: boolean;
  setShowShortcuts: (v: boolean) => void;

  // ── Pomodoro (global, survives navigation) ──
  pomPhase: PomPhase;
  pomSecondsLeft: number;
  pomRunning: boolean;
  pomWorkMins: number;
  pomBreakMins: number;
  pomSessions: number;
  pomVisible: boolean;
  showPomodoroSetup: () => void;
  hidePomodoroSetup: () => void;
  startPomodoro: (workMins: number, breakMins: number) => void;
  pausePomodoro: () => void;
  resumePomodoro: () => void;
  resetPomodoro: () => void;
  skipPomodoro: () => void;
  tickPomodoro: () => void;
  setPomSettings: (workMins: number, breakMins: number) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  collections: [],
  collectionsLoaded: false,
  setCollections: (collections) => set({ collections, collectionsLoaded: true }),

  pendingAchievements: [],
  pushAchievement: (a) => set((s) => ({ pendingAchievements: [...s.pendingAchievements, a] })),
  popAchievement: () => set((s) => ({ pendingAchievements: s.pendingAchievements.slice(1) })),

  pendingLevelUp: null,
  setPendingLevelUp: (info) => set({ pendingLevelUp: info }),
  clearLevelUp: () => set({ pendingLevelUp: null }),

  focusMode: false,
  setFocusMode: (focusMode) => set({ focusMode }),

  showShortcuts: false,
  setShowShortcuts: (showShortcuts) => set({ showShortcuts }),

  // ── Pomodoro ──
  pomPhase: 'idle',
  pomSecondsLeft: 25 * 60,
  pomRunning: false,
  pomWorkMins: 25,
  pomBreakMins: 5,
  pomSessions: 0,
  pomVisible: false,

  showPomodoroSetup: () => set({ pomVisible: true }),

  hidePomodoroSetup: () => set({
    pomVisible: false,
    pomPhase: 'idle',
    pomRunning: false,
  }),

  startPomodoro: (workMins, breakMins) => set({
    pomPhase: 'work',
    pomSecondsLeft: workMins * 60,
    pomRunning: true,
    pomWorkMins: workMins,
    pomBreakMins: breakMins,
    pomSessions: 0,
    pomVisible: true,
  }),

  pausePomodoro: () => set({ pomRunning: false }),
  resumePomodoro: () => set({ pomRunning: true }),

  resetPomodoro: () => set((s) => ({
    pomPhase: 'idle',
    pomSecondsLeft: s.pomWorkMins * 60,
    pomRunning: false,
    pomSessions: 0,
    pomVisible: false,
  })),

  skipPomodoro: () => set((s) => {
    if (s.pomPhase === 'work') {
      return { pomPhase: 'break' as PomPhase, pomSecondsLeft: s.pomBreakMins * 60, pomRunning: true, pomSessions: s.pomSessions + 1 };
    }
    return { pomPhase: 'work' as PomPhase, pomSecondsLeft: s.pomWorkMins * 60, pomRunning: true };
  }),

  tickPomodoro: () => {
    const s = get();
    if (!s.pomRunning || s.pomPhase === 'idle') return;
    if (s.pomSecondsLeft <= 1) {
      if (s.pomPhase === 'work') {
        set({ pomSecondsLeft: s.pomBreakMins * 60, pomPhase: 'break', pomRunning: true, pomSessions: s.pomSessions + 1 });
      } else {
        set({ pomSecondsLeft: s.pomWorkMins * 60, pomPhase: 'work', pomRunning: true });
      }
    } else {
      set({ pomSecondsLeft: s.pomSecondsLeft - 1 });
    }
  },

  setPomSettings: (workMins, breakMins) => set((s) => ({
    pomWorkMins: workMins,
    pomBreakMins: breakMins,
    pomSecondsLeft: s.pomPhase === 'idle' ? workMins * 60 : s.pomSecondsLeft,
  })),
}));
