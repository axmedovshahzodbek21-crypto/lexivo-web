'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSettings, saveSettings, setUILanguage, resetOnboarded, saveNameUpdatedAt, saveLevelUpdatedAt } from '@/lib/storage';
import { getTheme, setTheme, type Theme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { stopSync } from '@/lib/web-sync';
import {
  getNotifSettings, saveNotifSettings, requestNotifPermission,
  scheduleOrShowNotification, sendTestNotification,
  getNotifPermission, isNotifSupported, type NotifSettings,
} from '@/lib/notifications';
import { exportData, importData } from '@/lib/backup';
import type { UserSettings } from '@/lib/types';
import { translations } from '@/lib/i18n';

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<UserSettings>(() =>
    typeof window === 'undefined'
      ? { name: '', dailyGoal: 10, languageLevel: 'B1', defaultAccent: 'us', autoPlayOnReveal: true, sessionSize: 20, fontSize: 'normal', studyOrder: 'random', quizDirection: 'word-to-uz', reduceMotion: false, uiLanguage: 'en' as const, showOnLeaderboard: true }
      : getSettings()
  );
  const [saved, setSaved] = useState(false);
  const [theme, setThemeState] = useState<Theme>('light');
  const [notif, setNotif] = useState<NotifSettings>({ enabled: false, time: '20:00' });
  const [permission, setPermission] = useState<string>('default');
  const [testSent, setTestSent] = useState(false);
  const [notifSupported, setNotifSupported] = useState(false);
  const [resetConfirm, setResetConfirm]   = useState(false);
  const [resetLoading, setResetLoading]   = useState(false);
  const [resetError, setResetError]       = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError]     = useState('');
  const [importState, setImportState] = useState<'idle' | 'confirm' | 'success' | 'error'>('idle');
  const [importMsg, setImportMsg] = useState('');
  const [pendingImport, setPendingImport] = useState<string | null>(null);

  useEffect(() => {
    setThemeState(getTheme());
    setNotif(getNotifSettings());
    setPermission(getNotifPermission());
    setNotifSupported(isNotifSupported());
  }, []);

  const handleThemeSelect = (t: Theme) => {
    setTheme(t);
    setThemeState(t);
  };

  const handleFontSize = (size: UserSettings['fontSize']) => {
    setSettings(s => ({ ...s, fontSize: size }));
    if (size === 'normal') {
      delete document.documentElement.dataset.fontSize;
    } else {
      document.documentElement.dataset.fontSize = size;
    }
  };

  const handleReduceMotion = (value: boolean) => {
    setSettings(s => ({ ...s, reduceMotion: value }));
    if (value) {
      document.documentElement.dataset.reduceMotion = 'true';
    } else {
      delete document.documentElement.dataset.reduceMotion;
    }
  };

  const handleNotifToggle = async () => {
    if (!notif.enabled) {
      const perm = await requestNotifPermission();
      setPermission(perm);
      if (perm !== 'granted') return;
      const next = { ...notif, enabled: true };
      setNotif(next);
      saveNotifSettings(next);
      scheduleOrShowNotification(next);
    } else {
      const next = { ...notif, enabled: false };
      setNotif(next);
      saveNotifSettings(next);
    }
  };

  const handleTimeChange = (time: string) => {
    const next = { ...notif, time };
    setNotif(next);
    saveNotifSettings(next);
    if (next.enabled && permission === 'granted') scheduleOrShowNotification(next);
  };

  const handleTest = async () => {
    await sendTestNotification();
    setTestSent(true);
    setTimeout(() => setTestSent(false), 3000);
  };

  const handleExport = () => exportData();

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      // Dry-run to validate before confirming
      const result = importData(text);
      if (!result.ok) {
        setImportState('error');
        setImportMsg(result.error);
      } else {
        setPendingImport(text);
        setImportMsg(`Found ${result.learnedWords} learned words, ${result.srsWords} SRS words. This will overwrite your current progress.`);
        setImportState('confirm');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // reset so same file can be re-selected
  };

  const confirmImport = () => {
    if (!pendingImport) return;
    const result = importData(pendingImport);
    if (result.ok) {
      setImportState('success');
      setImportMsg(`Restored ${result.learnedWords} learned words and ${result.srsWords} SRS words.`);
      setTimeout(() => window.location.reload(), 1500);
    } else {
      setImportState('error');
      setImportMsg(result.error);
    }
    setPendingImport(null);
  };

  const handleResetProgress = async () => {
    setResetLoading(true);
    setResetError('');
    try {
      // Stop push timer first so it can't restore data during reset
      stopSync();

      // Clear localStorage before touching Supabase so a stale timer push can't sneak in
      const progressKeys = [
        'lexivo_learned_words', 'lexivo_srs_words', 'lexivo_starred',
        'lexivo_xp', 'lexivo_today_xp', 'lexivo_today_xp_date',
        'lexivo_today_count', 'lexivo_today_count_date',
        'lexivo_streak', 'lexivo_last_study', 'lexivo_total_study_days',
        'lexivo_freezes', 'lexivo_last_freeze_week',
      ];
      progressKeys.forEach(k => localStorage.removeItem(k));
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith('lexivo_unit_progress_')) toRemove.push(k);
      }
      toRemove.forEach(k => localStorage.removeItem(k));

      // Now delete from Supabase
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('srs_words').delete().eq('user_id', user.id);
        await supabase.from('learned_words').delete().eq('user_id', user.id);
        await supabase.from('starred_words').delete().eq('user_id', user.id);
        try { await supabase.from('unit_progress').delete().eq('user_id', user.id); } catch (_) {}
        await supabase.from('user_stats').delete().eq('id', user.id);
        await supabase.from('profiles').update({ reset_at: new Date().toISOString() }).eq('id', user.id);
      }
      window.location.replace('/');
    } catch (e) {
      setResetError('Something went wrong. Please try again.');
      setResetLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await supabase.rpc('delete_own_account');
      stopSync();
      await supabase.auth.signOut();
      window.location.replace('/login');
    } catch (e) {
      setDeleteError('Something went wrong. Please try again.');
      setDeleteLoading(false);
    }
  };

  const handleSave = () => {
    saveSettings(settings);
    saveNameUpdatedAt(new Date().toISOString());
    saveLevelUpdatedAt(new Date().toISOString());
    setSaved(true);
    setTimeout(() => { setSaved(false); router.back(); }, 1000);
  };

  const t = translations[settings.uiLanguage] ?? translations.en;

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="sticky top-0 z-10 -mx-4 px-4 py-3 bg-[var(--background)] border-b border-[var(--border)] flex items-center gap-3">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-[var(--surface-2)] flex items-center justify-center shrink-0">←</button>
        <h1 className="text-xl font-bold flex-1">{t.settings.title}</h1>
        <button
          onClick={handleSave}
          className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${saved ? 'bg-[var(--success)] text-white' : 'bg-[var(--primary)] text-white hover:bg-[var(--primary-dark)]'}`}
        >
          {saved ? t.settings.saved : t.settings.save}
        </button>
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold">{t.settings.profile}</h2>
        <div>
          <label className="text-sm font-medium text-[var(--text-muted)] block mb-1">{t.settings.yourName}</label>
          <input
            type="text"
            value={settings.name}
            onChange={e => setSettings(s => ({ ...s, name: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl bg-[var(--surface-2)] border-2 border-transparent focus:border-[var(--primary)] outline-none transition-colors"
            placeholder={t.settings.namePlaceholder}
          />
        </div>

        <div>
          <label className="text-sm font-medium text-[var(--text-muted)] block mb-1">{t.settings.dailyGoal}</label>
          <input
            type="number"
            min={1}
            max={100}
            value={settings.dailyGoal}
            onChange={e => setSettings(s => ({ ...s, dailyGoal: parseInt(e.target.value) || 10 }))}
            className="w-full px-4 py-3 rounded-xl bg-[var(--surface-2)] border-2 border-transparent focus:border-[var(--primary)] outline-none transition-colors"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-[var(--text-muted)] block mb-2">{t.settings.sessionSize}</label>
          <div className="grid grid-cols-5 gap-2">
            {[5, 10, 15, 20, 30].map(n => (
              <button
                key={n}
                onClick={() => setSettings(s => ({ ...s, sessionSize: n }))}
                className={`py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  settings.sessionSize === n
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1.5">{t.settings.sessionSizeHelper}</p>
        </div>

        <div>
          <label className="text-sm font-medium text-[var(--text-muted)] block mb-2">{t.settings.languageLevel}</label>
          <div className="grid grid-cols-3 gap-2">
            {(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const).map(level => (
              <button
                key={level}
                onClick={() => setSettings(s => ({ ...s, languageLevel: level }))}
                className={`py-2 rounded-xl text-sm font-medium transition-colors ${settings.languageLevel === level ? 'bg-[var(--primary)] text-white' : 'bg-[var(--surface-2)] text-[var(--text-muted)]'}`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => { resetOnboarded(); router.replace('/onboarding'); }}
          className="w-full py-2.5 rounded-xl border border-[var(--border)] text-sm text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-colors"
        >
          {t.settings.startSetupAgain}
        </button>
      </div>

      {/* Learning preferences */}
      <div className="card space-y-4">
        <h2 className="font-semibold">{t.settings.learning}</h2>

        <div>
          <p className="text-sm font-medium text-[var(--text)] mb-2">{t.settings.cardOrder}</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: 'random',   label: t.settings.random,   icon: '🔀' },
              { value: 'in-order', label: t.settings.inOrder,  icon: '🔢' },
            ] as const).map(({ value, label, icon }) => (
              <button
                key={value}
                onClick={() => setSettings(s => ({ ...s, studyOrder: value }))}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold transition-colors ${
                  settings.studyOrder === value
                    ? 'border-[var(--primary)] bg-[var(--primary-bg)] text-[var(--primary)]'
                    : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]'
                }`}
              >
                {icon} {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1.5">{t.settings.cardOrderHelper}</p>
        </div>

        <div>
          <p className="text-sm font-medium text-[var(--text)] mb-2">{t.settings.quizDirection}</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: 'word-to-uz', label: t.settings.engToUz },
              { value: 'uz-to-word', label: t.settings.uzToEng },
            ] as const).map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setSettings(s => ({ ...s, quizDirection: value }))}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold transition-colors ${
                  settings.quizDirection === value
                    ? 'border-[var(--primary)] bg-[var(--primary-bg)] text-[var(--primary)]'
                    : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1.5">{t.settings.quizDirectionHelper}</p>
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold">{t.settings.appearance}</h2>

        <div>
          <p className="text-sm font-medium text-[var(--text)] mb-2">{t.settings.theme}</p>
          <div className="grid grid-cols-3 gap-2">
            {([
              { value: 'system', label: t.settings.themeSystem, icon: '⚙️' },
              { value: 'light',  label: t.settings.themeLight,  icon: '☀️' },
              { value: 'dark',   label: t.settings.themeDark,   icon: '🌙' },
            ] as const).map(({ value, label, icon }) => (
              <button
                key={value}
                onClick={() => handleThemeSelect(value)}
                className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-colors ${
                  theme === value
                    ? 'border-[var(--primary)] bg-[var(--primary-bg)]'
                    : 'border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--primary)]'
                }`}
              >
                <span className="text-lg">{icon}</span>
                <span className="text-xs font-semibold" style={{ color: theme === value ? 'var(--primary)' : 'var(--text-muted)' }}>{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-[var(--text)] mb-2">{t.settings.fontSize}</p>
          <div className="grid grid-cols-3 gap-2">
            {([
              { value: 'compact', label: t.settings.fontCompact, sample: 'A−' },
              { value: 'normal',  label: t.settings.fontNormal,  sample: 'A'  },
              { value: 'large',   label: t.settings.fontLarge,   sample: 'A+' },
            ] as const).map(({ value, label, sample }) => (
              <button
                key={value}
                onClick={() => handleFontSize(value)}
                className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-colors ${
                  settings.fontSize === value
                    ? 'border-[var(--primary)] bg-[var(--primary-bg)]'
                    : 'border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--primary)]'
                }`}
              >
                <span className={`font-bold ${value === 'compact' ? 'text-base' : value === 'large' ? 'text-2xl' : 'text-xl'}`} style={{ color: settings.fontSize === value ? 'var(--primary)' : 'var(--text)' }}>
                  {sample}
                </span>
                <span className="text-xs text-[var(--text-muted)]">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--text)]">{t.settings.interfaceLang}</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{t.settings.interfaceLangHelper}</p>
          </div>
          <div className="flex rounded-xl overflow-hidden border border-[var(--border)]">
            {(['en', 'uz'] as const).map(lang => (
              <button
                key={lang}
                onClick={() => {
                  const next = { ...settings, uiLanguage: lang };
                  setSettings(next);
                  setUILanguage(lang);
                  saveSettings(next);
                  document.cookie = `lexivo_lang=${lang}; path=/; max-age=31536000; SameSite=Lax`;
                  document.documentElement.dataset.lang = lang;
                  window.dispatchEvent(new Event('lexivo-lang-change'));
                }}
                className={`px-4 py-2 text-sm font-semibold transition-colors ${settings.uiLanguage === lang ? 'bg-[var(--primary)] text-white' : 'bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-2)]'}`}
              >
                {lang === 'en' ? t.settings.langEn : t.settings.langUz}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
          <p className="text-sm font-medium text-[var(--text)]">{t.settings.reduceMotion}</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{t.settings.reduceMotionHelper}</p>
          </div>
          <button
            onClick={() => handleReduceMotion(!settings.reduceMotion)}
            className={`relative w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none ${settings.reduceMotion ? 'bg-[var(--primary)]' : 'bg-[var(--surface-2)]'}`}
            aria-label="Toggle reduce motion"
          >
            <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-md transform transition-transform duration-300 ${settings.reduceMotion ? 'translate-x-7' : 'translate-x-0'}`} />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--text)]">Show on leaderboard</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Display your name and XP in the public leaderboard</p>
          </div>
          <button
            onClick={() => setSettings(s => ({ ...s, showOnLeaderboard: !s.showOnLeaderboard }))}
            className={`relative w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none ${settings.showOnLeaderboard ?? true ? 'bg-[var(--primary)]' : 'bg-[var(--surface-2)]'}`}
            aria-label="Toggle leaderboard visibility"
          >
            <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-md transform transition-transform duration-300 ${settings.showOnLeaderboard ?? true ? 'translate-x-7' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>

      {/* Pronunciation */}
      <div className="card space-y-4">
        <h2 className="font-semibold">{t.settings.pronunciation}</h2>

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[var(--text)]">{t.settings.defaultAccent}</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{t.settings.accentHelper}</p>
          </div>
          <div className="flex rounded-xl overflow-hidden border border-[var(--border)] shrink-0">
            {(['us', 'uk'] as const).map(a => (
              <button
                key={a}
                onClick={() => setSettings(s => ({ ...s, defaultAccent: a }))}
                className={`px-4 py-2 text-sm font-semibold transition-colors flex items-center gap-1.5 ${
                  settings.defaultAccent === a
                    ? 'bg-[var(--primary)] text-white'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                {a === 'us' ? t.settings.american : t.settings.british}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--text)]">{t.settings.autoPlay}</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{t.settings.autoPlayHelper}</p>
          </div>
          <button
            onClick={() => setSettings(s => ({ ...s, autoPlayOnReveal: !s.autoPlayOnReveal }))}
            className={`relative w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none ${settings.autoPlayOnReveal ? 'bg-[var(--primary)]' : 'bg-[var(--surface-2)]'}`}
            aria-label="Toggle auto-play on reveal"
          >
            <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-md transform transition-transform duration-300 ${settings.autoPlayOnReveal ? 'translate-x-7' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>

      {/* Notifications */}
      {notifSupported ? (
        <div className="card space-y-4">
          <h2 className="font-semibold">{t.settings.dailyReminder}</h2>

          {/* Permission warning */}
          {permission === 'denied' && (
            <div className="bg-red-50 border border-[var(--danger)] rounded-xl p-3">
              <p className="text-xs text-[var(--danger)]">
                {t.settings.notifBlocked}
              </p>
            </div>
          )}

          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--text)]">{t.settings.enableReminder}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {notif.enabled ? t.settings.reminderOn(notif.time) : t.settings.reminderOff}
              </p>
            </div>
            <button
              onClick={handleNotifToggle}
              disabled={permission === 'denied'}
              className={`relative w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none disabled:opacity-40 ${notif.enabled ? 'bg-[var(--primary)]' : 'bg-[var(--surface-2)]'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-md transform transition-transform duration-300 ${notif.enabled ? 'translate-x-7' : 'translate-x-0'}`} />
            </button>
          </div>

          {/* Time picker */}
          {notif.enabled && permission === 'granted' && (
            <div>
              <label className="text-sm font-medium text-[var(--text-muted)] block mb-1">{t.settings.reminderTime}</label>
              <input
                type="time"
                value={notif.time}
                onChange={e => handleTimeChange(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[var(--surface-2)] border-2 border-transparent focus:border-[var(--primary)] outline-none transition-colors text-[var(--text)]"
              />
            </div>
          )}

          {/* Test button */}
          {permission === 'granted' && (
            <button
              onClick={handleTest}
              className="w-full py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-colors"
            >
              {testSent ? t.settings.testNotifSent : t.settings.testNotif}
            </button>
          )}
        </div>
      ) : (
        <div className="card">
          <h2 className="font-semibold mb-1">{t.settings.dailyReminder}</h2>
          <p className="text-sm text-[var(--text-muted)]">{t.settings.notifNotSupported}</p>
        </div>
      )}

      {/* Data backup */}
      <div className="card space-y-4">
        <div>
          <h2 className="font-semibold">{t.settings.dataBackup}</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{t.settings.dataBackupHelper}</p>
        </div>

        {/* Export */}
        <button
          onClick={handleExport}
          className="w-full flex items-center gap-3 p-3 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--primary-bg)] transition-colors text-left"
        >
          <span className="text-2xl">📤</span>
          <div>
            <p className="text-sm font-semibold text-[var(--text)]">{t.settings.exportProgress}</p>
            <p className="text-xs text-[var(--text-muted)]">{t.settings.exportHelper}</p>
          </div>
        </button>

        {/* Import */}
        <label className="w-full flex items-center gap-3 p-3 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--primary-bg)] transition-colors cursor-pointer">
          <span className="text-2xl">📥</span>
          <div>
            <p className="text-sm font-semibold text-[var(--text)]">{t.settings.importProgress}</p>
            <p className="text-xs text-[var(--text-muted)]">{t.settings.importHelper}</p>
          </div>
          <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
        </label>

        {/* Confirm dialog */}
        {importState === 'confirm' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 animate-fade-in space-y-3">
            <p className="text-sm font-semibold text-amber-800">{t.settings.confirmImport}</p>
            <p className="text-xs text-amber-700">{importMsg}</p>
            <div className="flex gap-2">
              <button onClick={() => setImportState('idle')} className="flex-1 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-colors">
                {t.settings.dismiss}
              </button>
              <button onClick={confirmImport} className="flex-1 py-2 rounded-xl bg-[var(--primary)] text-white text-sm font-semibold hover:bg-[var(--primary-dark)] transition-colors">
                {t.settings.yesOverwrite}
              </button>
            </div>
          </div>
        )}

        {/* Success / Error feedback */}
        {importState === 'success' && (
          <div className="bg-green-50 border border-[var(--success)] rounded-xl p-3 animate-fade-in">
            <p className="text-sm font-semibold text-[var(--success)]">{t.settings.importSuccess}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">{importMsg} {t.settings.reloading}</p>
          </div>
        )}
        {importState === 'error' && (
          <div className="bg-red-50 border border-[var(--danger)] rounded-xl p-3 animate-fade-in">
            <p className="text-sm font-semibold text-[var(--danger)]">{t.settings.importFailed}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">{importMsg}</p>
            <button onClick={() => setImportState('idle')} className="text-xs text-[var(--primary)] mt-2 underline">{t.settings.dismiss}</button>
          </div>
        )}
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold">{t.settings.about}</h2>
        <p className="text-sm text-[var(--text-muted)]">
          {t.settings.aboutText}
        </p>
        <p className="text-xs text-[var(--text-muted)]">{t.settings.aboutStorage}</p>
        <a
          href="https://github.com/axmedovshahzodbek21-crypto/lexivo-web/releases/latest/download/app-release.apk"
          download
          className="flex items-center gap-3 p-3 rounded-2xl w-full"
          style={{ background: 'rgba(61,220,132,0.08)', border: '1.5px solid rgba(61,220,132,0.35)' }}
        >
          <span className="text-xl">🤖</span>
          <div className="flex-1 text-left">
            <span className="font-semibold text-sm block" style={{ color: '#3DDC84' }}>{t.home.downloadApp}</span>
            <span className="text-xs text-[var(--text-muted)]">{t.home.downloadSub}</span>
          </div>
          <span className="text-sm font-bold" style={{ color: '#3DDC84' }}>↓</span>
        </a>
      </div>

      {/* Danger Zone */}
      <div className="card border-2 border-[var(--danger)] space-y-3" style={{ borderColor: 'rgba(239,68,68,0.3)' }}>
        <h2 className="font-semibold text-[var(--danger)]">{t.settings.dangerZone}</h2>

        {/* Reset Progress */}
        {!resetConfirm ? (
          <button
            onClick={() => setResetConfirm(true)}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-red-50 hover:bg-red-100 transition-colors text-left"
          >
            <span className="text-2xl">🔄</span>
            <div>
              <p className="text-sm font-semibold text-[var(--danger)]">{t.settings.resetProgress}</p>
              <p className="text-xs text-[var(--text-muted)]">{t.settings.resetSub}</p>
            </div>
          </button>
        ) : (
          <div className="space-y-3 animate-fade-in">
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 space-y-2">
              <p className="text-sm font-bold text-[var(--danger)]">{t.settings.resetWarning}</p>
              <ul className="text-xs text-[var(--text-muted)] space-y-1">
                <li>• {t.settings.resetItem1}</li>
                <li>• {t.settings.resetItem2}</li>
                <li>• {t.settings.resetItem3}</li>
                <li>• {t.settings.resetItem4}</li>
                <li>• {t.settings.resetItem5}</li>
              </ul>
              <p className="text-xs text-[var(--text-muted)] mt-1">{t.settings.resetKeep}</p>
              <p className="text-xs font-bold text-[var(--danger)]">{t.settings.cannotUndo}</p>
            </div>
            {resetError && <p className="text-xs text-[var(--danger)]">{resetError}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => { setResetConfirm(false); setResetError(''); }}
                className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-sm text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-colors"
              >
                {t.settings.dismiss}
              </button>
              <button
                onClick={handleResetProgress}
                disabled={resetLoading}
                className="flex-1 py-2.5 rounded-xl bg-[var(--danger)] text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {resetLoading ? t.settings.resetting : t.settings.resetBtn}
              </button>
            </div>
          </div>
        )}

        <div className="border-t border-[var(--border)]" />

        {!deleteConfirm ? (
          <button
            onClick={() => setDeleteConfirm(true)}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-red-50 hover:bg-red-100 transition-colors text-left"
          >
            <span className="text-2xl">🗑️</span>
            <div>
              <p className="text-sm font-semibold text-[var(--danger)]">{t.settings.deleteAccount}</p>
              <p className="text-xs text-[var(--text-muted)]">{t.settings.deleteSub}</p>
            </div>
          </button>
        ) : (
          <div className="space-y-3 animate-fade-in">
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 space-y-2">
              <p className="text-sm font-bold text-[var(--danger)]">{t.settings.resetWarning}</p>
              <ul className="text-xs text-[var(--text-muted)] space-y-1">
                <li>• {t.settings.deleteItem1}</li>
                <li>• {t.settings.resetItem1}</li>
                <li>• {t.settings.resetItem2}</li>
                <li>• {t.settings.resetItem3}</li>
                <li>• {t.settings.resetItem4}</li>
              </ul>
              <p className="text-xs font-bold text-[var(--danger)] mt-2">{t.settings.cannotUndo}</p>
            </div>

            {deleteError && (
              <p className="text-xs text-[var(--danger)]">{deleteError}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => { setDeleteConfirm(false); setDeleteError(''); }}
                className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-sm text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-colors"
              >
                {t.settings.dismiss}
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteLoading}
                className="flex-1 py-2.5 rounded-xl bg-[var(--danger)] text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {deleteLoading ? t.settings.deleting : t.settings.deleteForever}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="pb-4" />
    </div>
  );
}
