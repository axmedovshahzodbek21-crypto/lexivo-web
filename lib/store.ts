'use client';
import { create } from 'zustand';
import type { WordCollection, Achievement } from './types';
import { addFocusSeconds } from './storage';

type PomPhase = 'idle' | 'work' | 'break';

const POM_STORAGE_KEY = 'lexivo_pomodoro_state';

interface PomSnapshot {
  phase: PomPhase;
  secondsLeft: number;
  running: boolean;
  workMins: number;
  breakMins: number;
  sessions: number;
  visible: boolean;
  savedAt: number; // Date.now() at write time — used to replay elapsed wall-clock time on rehydration
}

// Walks the pomodoro forward by `elapsedSecs` of real wall-clock time from
// its current phase/secondsLeft, crossing as many phase boundaries as
// necessary. Used both by tickPomodoro (elapsed since the last tick) and by
// hydratePomodoro (elapsed since the tab was last open) — the same replay
// logic fixes two different bugs: tickPomodoro no longer assumes exactly
// 1s passed between ticks (background-tab setInterval throttling made it
// undercount real elapsed time), and a page refresh/reopen can resume
// mid-session instead of resetting to idle.
function advancePhase(
  phase: PomPhase, secondsLeft: number, sessions: number,
  workMins: number, breakMins: number, elapsedSecs: number,
): { phase: PomPhase; secondsLeft: number; sessions: number } {
  let remaining = elapsedSecs;
  let p = phase, left = secondsLeft, s = sessions;
  // Capped at 100 iterations — a genuinely stuck loop (e.g. a 0-minute
  // phase length) would otherwise hang the tab instead of just producing
  // an approximate result.
  for (let i = 0; i < 100 && remaining > 0 && p !== 'idle'; i++) {
    if (remaining < left) { left -= remaining; remaining = 0; break; }
    remaining -= left;
    if (p === 'work') { p = 'break'; left = breakMins * 60; s += 1; }
    else { p = 'work'; left = workMins * 60; }
  }
  return { phase: p, secondsLeft: left, sessions: s };
}

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

  // ── Pomodoro (global, survives navigation; persisted — see hydratePomodoro) ──
  pomPhase: PomPhase;
  pomSecondsLeft: number;
  pomRunning: boolean;
  pomWorkMins: number;
  pomBreakMins: number;
  pomSessions: number;
  pomVisible: boolean;
  pomLastTickAt: number | null;
  hydratePomodoro: () => void;
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

export const useAppStore = create<AppState>((set, get) => {
  // Persists the fields needed to resume — called at the end of every
  // pomodoro action below. Never called during module init/SSR (all call
  // sites are store actions, only ever invoked client-side from user
  // interaction or a client-only effect).
  function persistPom() {
    const s = get();
    const snap: PomSnapshot = {
      phase: s.pomPhase, secondsLeft: s.pomSecondsLeft, running: s.pomRunning,
      workMins: s.pomWorkMins, breakMins: s.pomBreakMins, sessions: s.pomSessions,
      visible: s.pomVisible, savedAt: Date.now(),
    };
    try { localStorage.setItem(POM_STORAGE_KEY, JSON.stringify(snap)); } catch {}
  }

  return {
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
  pomLastTickAt: null,

  // Reads the persisted snapshot and, if a session was left running,
  // replays the wall-clock time that passed while this tab was closed so
  // the timer resumes at the correct phase/secondsLeft instead of
  // silently going back to idle. Call once, client-side only (e.g. from a
  // top-level layout effect) — never from the store initializer itself,
  // which also runs during SSR for this 'use client' module.
  hydratePomodoro: () => {
    try {
      const raw = localStorage.getItem(POM_STORAGE_KEY);
      if (!raw) return;
      const snap = JSON.parse(raw) as PomSnapshot;
      if (snap.phase === 'idle') {
        set({ pomWorkMins: snap.workMins, pomBreakMins: snap.breakMins });
        return;
      }
      if (!snap.running) {
        set({
          pomPhase: snap.phase, pomSecondsLeft: snap.secondsLeft, pomRunning: false,
          pomWorkMins: snap.workMins, pomBreakMins: snap.breakMins,
          pomSessions: snap.sessions, pomVisible: snap.visible,
        });
        return;
      }
      const elapsed = Math.max(0, Math.floor((Date.now() - snap.savedAt) / 1000));
      const next = advancePhase(snap.phase, snap.secondsLeft, snap.sessions, snap.workMins, snap.breakMins, elapsed);
      set({
        pomPhase: next.phase, pomSecondsLeft: next.secondsLeft, pomRunning: true,
        pomWorkMins: snap.workMins, pomBreakMins: snap.breakMins,
        pomSessions: next.sessions, pomVisible: snap.visible,
        pomLastTickAt: Date.now(),
      });
    } catch {}
  },

  showPomodoroSetup: () => { set({ pomVisible: true }); persistPom(); },

  hidePomodoroSetup: () => {
    set({ pomVisible: false, pomPhase: 'idle', pomRunning: false });
    persistPom();
  },

  startPomodoro: (workMins, breakMins) => {
    set({
      pomPhase: 'work', pomSecondsLeft: workMins * 60, pomRunning: true,
      pomWorkMins: workMins, pomBreakMins: breakMins, pomSessions: 0,
      pomVisible: true, pomLastTickAt: Date.now(),
    });
    persistPom();
  },

  pausePomodoro: () => { set({ pomRunning: false, pomLastTickAt: null }); persistPom(); },
  resumePomodoro: () => { set({ pomRunning: true, pomLastTickAt: Date.now() }); persistPom(); },

  resetPomodoro: () => {
    set((s) => ({
      pomPhase: 'idle', pomSecondsLeft: s.pomWorkMins * 60, pomRunning: false,
      pomSessions: 0, pomVisible: false, pomLastTickAt: null,
    }));
    persistPom();
  },

  skipPomodoro: () => {
    set((s) => {
      if (s.pomPhase === 'work') {
        return { pomPhase: 'break' as PomPhase, pomSecondsLeft: s.pomBreakMins * 60, pomRunning: true, pomSessions: s.pomSessions + 1, pomLastTickAt: Date.now() };
      }
      return { pomPhase: 'work' as PomPhase, pomSecondsLeft: s.pomWorkMins * 60, pomRunning: true, pomLastTickAt: Date.now() };
    });
    persistPom();
  },

  tickPomodoro: () => {
    const s = get();
    if (!s.pomRunning || s.pomPhase === 'idle') return;
    const now = Date.now();
    // Real elapsed time since the last tick, not a fixed 1s — a
    // background/throttled tab can fire setInterval far less often than
    // once per second, which previously made both the countdown and the
    // focus-seconds counter undercount real elapsed time.
    const elapsed = s.pomLastTickAt ? Math.max(0, Math.round((now - s.pomLastTickAt) / 1000)) : 1;
    if (elapsed <= 0) return;
    if (s.pomPhase === 'work') addFocusSeconds(elapsed);
    const next = advancePhase(s.pomPhase, s.pomSecondsLeft, s.pomSessions, s.pomWorkMins, s.pomBreakMins, elapsed);
    set({ pomPhase: next.phase, pomSecondsLeft: next.secondsLeft, pomSessions: next.sessions, pomLastTickAt: now });
    persistPom();
  },

  setPomSettings: (workMins, breakMins) => {
    set((s) => ({
      pomWorkMins: workMins, pomBreakMins: breakMins,
      pomSecondsLeft: s.pomPhase === 'idle' ? workMins * 60 : s.pomSecondsLeft,
    }));
    persistPom();
  },
  };
});
