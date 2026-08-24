// Generic retry queue for best-effort Supabase writes that must not be
// silently lost when the browser is offline (or a request otherwise fails
// mid-flight). A write is attempted immediately; only on failure does it get
// persisted to localStorage, so an online, successful write never touches
// the queue at all. Persisted entries are replayed on the browser's 'online'
// event and once at app startup (initOfflineQueueFlush, wired into layout).
//
// Call sites register an executor by `type` (module-load side effect, e.g.
// class-xp.ts registers 'record_class_xp') instead of the queue storing
// functions directly — functions aren't JSON-serializable, so a page reload
// with pending items still needs a live executor to replay against.

const QUEUE_KEY = 'lexivo_offline_queue';
// A write failing this many times has almost certainly hit a real server-side
// rejection (not just "still offline") — stop retrying so a bad payload
// doesn't sit retrying forever and spamming the network on every reconnect.
const MAX_ATTEMPTS = 8;

interface QueuedWrite {
  id: string;
  type: string;
  payload: unknown;
  ts: number;
  attempts: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Executor = (payload: any) => Promise<void>;
const registry = new Map<string, Executor>();

export function registerOfflineWriter(type: string, fn: Executor): void {
  registry.set(type, fn);
}

function readQueue(): QueuedWrite[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function writeQueue(q: QueuedWrite[]): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch {}
}

// Runs `type`'s executor against `payload` right now; if that throws (offline,
// network error, server error), persists it to the retry queue instead of
// letting the caller's own try/catch just log-and-forget it.
export async function enqueueOfflineWrite(type: string, payload: unknown): Promise<void> {
  const executor = registry.get(type);
  if (!executor) {
    console.error(`[offline-queue] no executor registered for "${type}" — dropping write`, payload);
    return;
  }
  try {
    await executor(payload);
  } catch (e) {
    const q = readQueue();
    q.push({ id: `${Date.now()}_${Math.random().toString(36).slice(2)}`, type, payload, ts: Date.now(), attempts: 0 });
    writeQueue(q);
    console.warn(`[offline-queue] "${type}" failed, queued for retry on reconnect:`, e);
  }
}

let flushing = false;

// Replays queued writes in order, oldest first. Stops at the first item that
// still fails (very likely still offline) rather than burning through the
// rest of the queue and racking up attempt counts for items that were never
// actually tried this pass.
export async function flushOfflineQueue(): Promise<void> {
  if (flushing) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  flushing = true;
  try {
    const q = readQueue();
    if (q.length === 0) return;
    for (let i = 0; i < q.length; i++) {
      const item = q[i];
      const executor = registry.get(item.type);
      if (!executor) continue; // not registered yet this session — leave for a later flush

      try {
        await executor(item.payload);
        (q[i] as unknown) = null; // mark for removal below
      } catch (e) {
        item.attempts += 1;
        if (item.attempts >= MAX_ATTEMPTS) {
          console.error(`[offline-queue] dropping "${item.type}" after ${MAX_ATTEMPTS} failed attempts:`, item.payload, e);
          (q[i] as unknown) = null;
        }
        break; // likely still offline — don't hammer the rest of the queue
      }
    }
    writeQueue(q.filter((item): item is QueuedWrite => item != null));
  } finally {
    flushing = false;
  }
}

// Mounted once app-wide (see components/OfflineQueueFlusher.tsx). Returns a
// cleanup function for the caller's useEffect.
export function initOfflineQueueFlush(): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => { void flushOfflineQueue(); };
  window.addEventListener('online', handler);
  void flushOfflineQueue(); // pick up anything left over from a previous session
  return () => window.removeEventListener('online', handler);
}
