import { localDateStr } from './storage';

const BACKUP_VERSION = 1;

// Every Lexivo localStorage key, discovered dynamically rather than hand-
// maintained — the previous fixed list omitted most real keys (imported
// words, review log, streak-validity day-sets, XP history, achievement
// dates, custom lists, per-unit progress, ...), so exporting then restoring
// a backup silently lost the majority of a user's data despite the export
// reporting success. Per-unit progress in particular is stored under
// dynamically-suffixed keys (lexivo_unit_progress_<collection>_<day>) that
// could never have matched a fixed list at all.
function getLexivoKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith('lexivo_')) keys.push(k);
  }
  return keys;
}

export interface BackupFile {
  version: number;
  exportedAt: string;
  appName: string;
  data: Record<string, unknown>;
}

export function exportData(): void {
  const data: Record<string, unknown> = {};
  for (const key of getLexivoKeys()) {
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

  const date = localDateStr();
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

  // Restore whatever keys the backup file actually contains — not a fixed
  // list — so older backups (fewer keys) and newer ones (more keys, as this
  // app adds features) both restore correctly rather than silently dropping
  // anything outside a hardcoded set.
  for (const key of Object.keys(data)) {
    if (!key.startsWith('lexivo_')) continue;
    localStorage.setItem(key, JSON.stringify(data[key]));
    keysRestored++;
  }

  const learnedWords = Array.isArray(data['lexivo_learned_words'])
    ? (data['lexivo_learned_words'] as unknown[]).length
    : 0;
  const srsWords = Array.isArray(data['lexivo_srs_words'])
    ? (data['lexivo_srs_words'] as unknown[]).length
    : 0;

  return { ok: true, keysRestored, learnedWords, srsWords };
}
