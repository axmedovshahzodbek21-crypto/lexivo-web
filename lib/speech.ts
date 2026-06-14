'use client';

let currentUtterance: SpeechSynthesisUtterance | null = null;

function pickVoice(langCode: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  // Prefer local (on-device) voice for the exact lang, then any voice for that lang
  return (
    voices.find(v => v.lang === langCode && v.localService) ??
    voices.find(v => v.lang.startsWith(langCode)) ??
    voices.find(v => v.lang.startsWith('en')) ??
    null
  );
}

function doSpeak(text: string, langCode: string, rate: number) {
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = langCode;
  u.rate = rate;
  u.pitch = 1;
  const voice = pickVoice(langCode);
  if (voice) u.voice = voice;
  currentUtterance = u;
  window.speechSynthesis.speak(u);
}

export type Accent = 'us' | 'uk';

const LANG: Record<Accent, string> = { us: 'en-US', uk: 'en-GB' };

export function speakAccent(text: string, accent: Accent = 'us', rate = 0.9) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const langCode = LANG[accent];
  // Voices may not be loaded yet on first call — wait for the event if needed
  if (window.speechSynthesis.getVoices().length > 0) {
    doSpeak(text, langCode, rate);
  } else {
    window.speechSynthesis.addEventListener(
      'voiceschanged',
      () => doSpeak(text, langCode, rate),
      { once: true },
    );
  }
}

// Legacy wrapper kept for other screens that call speak()
export function speak(text: string, rate = 0.9) {
  speakAccent(text, 'us', rate);
}

export function stopSpeech() {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speakText(text: string, langCode: string, rate = 0.9) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  if (window.speechSynthesis.getVoices().length > 0) {
    doSpeak(text, langCode, rate);
  } else {
    window.speechSynthesis.addEventListener('voiceschanged', () => doSpeak(text, langCode, rate), { once: true });
  }
}
