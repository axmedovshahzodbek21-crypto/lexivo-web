import { supabase } from './supabase';

export type MatchScore = 'perfect' | 'close' | 'wrong';

export function isRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

export function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z\s'-]/g, '').trim();
}

// ── Word scoring ─────────────────────────────────────────────────────────────

export function scoreMatch(heardList: string[], target: string): MatchScore {
  const t = normalize(target);
  for (const heard of heardList) {
    const h = normalize(heard);
    if (!h) continue;
    if (h === t) return 'perfect';
    const heardWords = h.split(/\s+/);
    if (heardWords.includes(t)) return 'perfect';
    if (levenshtein(h, t) <= 1) return 'perfect';
    if (heardWords.some(w => levenshtein(w, t) <= Math.ceil(t.length * 0.3))) return 'close';
    if (levenshtein(h, t) / Math.max(h.length, t.length) <= 0.3) return 'close';
  }
  return 'wrong';
}

// ── Sentence scoring ──────────────────────────────────────────────────────────

export function scoreSentenceMatch(heardList: string[], target: string): MatchScore {
  // Focus on content words (length > 3) for scoring to avoid noise from articles/prepositions
  const contentWords = normalize(target).split(/\s+/).filter(w => w.length > 3);
  if (contentWords.length === 0) return scoreMatch(heardList, target);

  for (const heard of heardList) {
    const h = normalize(heard);
    if (!h) continue;
    const hw = h.split(/\s+/);
    const matched = contentWords.filter(tw =>
      hw.some(w => w === tw || levenshtein(w, tw) <= 1)
    );
    const ratio = matched.length / contentWords.length;
    if (ratio >= 0.85) return 'perfect';
    if (ratio >= 0.55) return 'close';
  }
  return 'wrong';
}

// ── Visual word diff ──────────────────────────────────────────────────────────

export interface DiffToken { text: string; ok: boolean }

export function diffWords(heard: string, target: string): DiffToken[] {
  const hw = normalize(heard).split(/\s+/);
  return target.split(/\s+/).map(word => {
    const tw = normalize(word);
    const ok = hw.some(w => w === tw || levenshtein(w, tw) <= 1);
    return { text: word, ok };
  });
}

// ── Recognizer ────────────────────────────────────────────────────────────────

export interface Recognizer {
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export function createRecognizer(
  onResult: (transcripts: string[]) => void,
  onEnd: () => void,
  onError: (err: string) => void,
  onStart: () => void,
  lang = 'en-US',
): Recognizer | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
  if (!SR) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r: any = new SR();
  r.lang = lang;
  r.continuous = false;
  r.interimResults = false;
  r.maxAlternatives = 5;

  r.onstart = onStart;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  r.onresult = (event: any) => {
    const transcripts: string[] = [];
    for (let i = 0; i < event.results[0].length; i++)
      transcripts.push(event.results[0][i].transcript.trim());
    onResult(transcripts);
  };

  r.onend = onEnd;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  r.onerror = (event: any) => {
    if (event.error !== 'no-speech' && event.error !== 'aborted') onError(event.error);
    onEnd();
  };

  return {
    start: () => { try { r.start(); } catch { /* already started */ } },
    stop:  () => { try { r.stop();  } catch { /* already stopped */ } },
    abort: () => { try { r.abort(); } catch { /* already aborted */ } },
  };
}

export const XP_BY_SCORE: Record<MatchScore, number> = {
  perfect: 5,
  close: 2,
  wrong: 0,
};

// ── Whisper-based recognizer (works in all regions, no Google dependency) ──────

export function isRecordingSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'MediaRecorder' in window &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

export function createWhisperRecognizer(
  onResult: (transcripts: string[]) => void,
  onEnd: () => void,
  onError: (err: string) => void,
  onStart: () => void,
  onProcessing: () => void,
): Recognizer {
  let recorder: MediaRecorder | null = null;
  const chunks: Blob[] = [];
  let aborted = false;

  return {
    start: async () => {
      aborted = false;
      chunks.length = 0;

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e: unknown) {
        const name = e instanceof DOMException ? e.name : '';
        onError(name === 'NotAllowedError' || name === 'PermissionDeniedError' ? 'not-allowed' : 'audio-capture');
        onEnd();
        return;
      }

      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg', 'audio/mp4']
        .find(t => MediaRecorder.isTypeSupported(t)) ?? '';

      recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (aborted) { onEnd(); return; }

        const blob = new Blob(chunks, { type: recorder?.mimeType ?? 'audio/webm' });
        if (blob.size < 500) { onResult([]); onEnd(); return; }

        onProcessing();

        try {
          const { data: { session } } = await supabase.auth.getSession();
          const form = new FormData();
          form.append('audio', blob, 'audio.webm');
          const res = await fetch('/api/transcribe', {
            method: 'POST',
            body: form,
            headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
          });
          if (!res.ok) {
            onError(res.status === 503 || res.status === 401 || res.status === 429 ? 'no-api-key' : 'network');
            onEnd();
            return;
          }
          const { text } = await res.json() as { text?: string };
          onResult(text ? [text] : []);
        } catch {
          onError('network');
        }
        onEnd();
      };

      recorder.start();
      onStart();
    },
    stop:  () => { try { recorder?.stop();  } catch { /* already stopped */ } },
    abort: () => { aborted = true; try { recorder?.stop(); } catch { /* */ } },
  };
}
