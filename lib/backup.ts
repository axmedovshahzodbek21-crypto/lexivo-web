const BACKUP_VERSION = 1;

// All keys that belong to Lexivo's localStorage data
const LEXIVO_KEYS = [
  'lexivo_learned_words',
  'lexivo_srs_words',
  'lexivo_streak',
  'lexivo_last_study',
  'lexivo_total_study_days',
  'lexivo_xp',
  'lexivo_today_xp',
  'lexivo_today_xp_date',
  'lexivo_today_count',
  'lexivo_today_count_date',
  'lexivo_unit_progress',
  'lexivo_starred',
  'lexivo_achievements',
  'lexivo_settings',
  'lexivo_hard_words',
  'lexivo_notif_settings',
  'lexivo_theme',
  'lexivo_last_notif',
  'lexivo_onboarded',
];

export interface BackupFile {
  version: number;
  exportedAt: string;
  appName: string;
  data: Record<string, unknown>;
}

export function exportData(): void {
  const data: Record<string, unknown> = {};
  for (const key of LEXIVO_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      try { data[key] = JSON.parse(raw); } catch { data[key] = raw; }
    }
  }

  const backup: BackupFile = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    appName: 'Lexivo',
    data,
  };

  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const date = new Date().toISOString().split('T')[0];
  const a = document.createElement('a');
  a.href = url;
  a.download = `lexivo-backup-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export type ImportResult =
  | { ok: true; keysRestored: number; learnedWords: number; srsWords: number }
  | { ok: false; error: string };

export function importData(jsonStr: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return { ok: false, error: 'Invalid file — could not parse JSON.' };
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('version' in parsed) ||
    !('data' in parsed) ||
    (parsed as BackupFile).appName !== 'Lexivo'
  ) {
    return { ok: false, error: 'This file does not look like a Lexivo backup.' };
  }

  const backup = parsed as BackupFile;

  if (backup.version > BACKUP_VERSION) {
    return { ok: false, error: `Backup version ${backup.version} is newer than this app supports.` };
  }

  const data = backup.data as Record<string, unknown>;
  let keysRestored = 0;

  for (const key of LEXIVO_KEYS) {
    if (key in data) {
      localStorage.setItem(key, JSON.stringify(data[key]));
      keysRestored++;
    }
  }

  const learnedWords = Array.isArray(data['lexivo_learned_words'])
    ? (data['lexivo_learned_words'] as unknown[]).length
    : 0;
  const srsWords = Array.isArray(data['lexivo_srs_words'])
    ? (data['lexivo_srs_words'] as unknown[]).length
    : 0;

  return { ok: true, keysRestored, learnedWords, srsWords };
}
