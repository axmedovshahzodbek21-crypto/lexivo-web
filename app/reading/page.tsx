'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { addImportedWords } from '@/lib/storage';
import type { ImportedWord } from '@/lib/types';

function highlightParagraph(text: string, collected: string[]): React.ReactNode {
  if (collected.length === 0) return text;
  const sorted = [...collected].sort((a, b) => b.length - a.length);
  const escaped = sorted.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, i) => {
    if (collected.some(w => w.toLowerCase() === part.toLowerCase())) {
      return (
        <mark key={i} className="bg-[var(--primary)] text-white rounded-sm px-0.5 not-italic">
          {part}
        </mark>
      );
    }
    return part;
  });
}

const buildPrompt = (words: string[]) =>
`I have a list of English words I want to learn. For each word, provide the translation in Uzbek, a short definition in English, and 2 example sentences in English with their Uzbek translations.

Format EXACTLY like this for every word. Use plain text only — no markdown, no bold, no asterisks, no extra formatting:

word: enormous
partOfSpeech: adjective
pronunciation: /ɪˈnɔːrməs/
translation: ulkan
definition: extremely large in size or extent
example1: The enormous building towered above the city.
example1Translation: Ulkan bino shahar ustida baland turardi.
example2: She faced an enormous challenge at work.
example2Translation: U ishda ulkan muammoga duch keldi.
---

Important: the example above uses English/Uzbek only to show the format. In your actual response, write the definition and examples in English, and the translations in Uzbek.

Here are my words:
${words.join('\n')}
---`;

function parseAIResponse(text: string): ImportedWord[] {
  const blocks = text.split('---').map(b => b.trim()).filter(Boolean);
  return blocks.flatMap(block => {
    const get = (key: string) => {
      const m = block.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
      return m ? m[1].trim() : '';
    };
    const word = get('word');
    if (!word) return [];
    return [{
      word,
      translation: get('translation') || '',
      definition: get('definition') || '',
      example1: get('example1') || '',
      example1Translation: get('example1Translation') || undefined,
      example2: get('example2') || '',
      example2Translation: get('example2Translation') || undefined,
      language: 'en-US',
      addedAt: Date.now(),
    } satisfies ImportedWord];
  });
}

export default function ReadingPage() {
  const [passage, setPassage] = useState('');
  const [reading, setReading] = useState(false);
  const [wordList, setWordList] = useState<string[]>([]);
  const [selectedText, setSelectedText] = useState('');
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
  const [copied, setCopied] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [parsedWords, setParsedWords] = useState<ImportedWord[] | null>(null);
  const [importDone, setImportDone] = useState(false);
  const passageRef = useRef<HTMLDivElement>(null);

  const prompt = buildPrompt(wordList);

  const handleSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !passageRef.current?.contains(sel.anchorNode)) {
      setSelectedText('');
      setSelectionRect(null);
      return;
    }
    const text = sel.toString().trim();
    if (!text) { setSelectedText(''); setSelectionRect(null); return; }
    const range = sel.getRangeAt(0);
    setSelectionRect(range.getBoundingClientRect());
    setSelectedText(text);
  }, []);

  useEffect(() => {
    document.addEventListener('mouseup', handleSelection);
    document.addEventListener('touchend', handleSelection);
    return () => {
      document.removeEventListener('mouseup', handleSelection);
      document.removeEventListener('touchend', handleSelection);
    };
  }, [handleSelection]);

  const addWord = useCallback(() => {
    if (!selectedText) return;
    const cleaned = selectedText.replace(/\s+/g, ' ').trim();
    setWordList(prev => prev.includes(cleaned) ? prev : [...prev, cleaned]);
    window.getSelection()?.removeAllRanges();
    setSelectedText('');
    setSelectionRect(null);
  }, [selectedText]);

  const removeWord = (i: number) => setWordList(prev => prev.filter((_, idx) => idx !== i));

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleParse = () => setParsedWords(parseAIResponse(importText));

  const handleImport = () => {
    if (!parsedWords?.length) return;
    addImportedWords(parsedWords, 'My Words');
    setImportDone(true);
    setParsedWords(null);
    setImportText('');
    setTimeout(() => setImportDone(false), 3000);
  };

  // ── Step 1: paste passage ─────────────────────────────────────────────────
  if (!reading) {
    return (
      <div className="max-w-xl mx-auto px-6 py-10 space-y-6 pb-24">
        <div>
          <h1 className="text-3xl font-bold text-[var(--text)] mb-2">Reading</h1>
          <p className="text-sm text-[var(--text-muted)] leading-relaxed">
            Paste any English text. Select words as you read — we collect them and build an AI prompt to create vocabulary cards.
          </p>
        </div>
        <textarea
          className="w-full h-56 p-4 rounded-2xl border-2 border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-base resize-none focus:outline-none focus:border-[var(--primary)] transition-colors leading-relaxed"
          placeholder="Paste your reading passage here…"
          value={passage}
          onChange={e => setPassage(e.target.value)}
          autoFocus
        />
        <button
          onClick={() => { if (passage.trim()) setReading(true); }}
          disabled={!passage.trim()}
          className="btn-primary w-full disabled:opacity-40"
        >
          Start Reading →
        </button>
      </div>
    );
  }

  // ── Step 2: reading mode ──────────────────────────────────────────────────
  const paragraphs = passage.split('\n').map(p => p.trim()).filter(Boolean);
  const wordCount = passage.split(/\s+/).filter(Boolean).length;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  return (
    <div className="max-w-4xl mx-auto pb-28">
      {/* Sticky header with progress bar */}
      <div className="sticky top-0 z-10 bg-[var(--bg)] border-b border-[var(--border)]">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => { setReading(false); setWordList([]); setSelectedText(''); setSelectionRect(null); }}
            className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            ← Back
          </button>
          <span className="text-xs text-[var(--text-muted)]">~{readingTime} min read</span>
        </div>
      </div>

      {/* Passage card */}
      <div className="mx-4 mt-6 mb-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
        {/* Reading meta */}
        <div className="px-8 pt-6 pb-2 border-b border-[var(--border)]">
          <p className="text-xs text-[var(--text-muted)]">
            Select any word or phrase → tap <strong className="text-[var(--primary)]">+ Add</strong> to collect it
          </p>
        </div>

        {/* Paragraphs */}
        <div
          ref={passageRef}
          className="px-8 py-6 text-[var(--text)] text-[17px] leading-[1.85] select-text cursor-text space-y-5"
          style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
        >
          {paragraphs.map((para, i) => (
            <p key={i}>{highlightParagraph(para, wordList)}</p>
          ))}
        </div>
      </div>

      {/* Floating word count badge */}
      {wordList.length > 0 && (
        <div className="fixed bottom-24 right-4 z-40 sm:bottom-6">
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-[var(--primary)] text-white text-xs font-bold shadow-lg">
            <span>📝</span>
            <span>{wordList.length} word{wordList.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      )}

      {/* Floating "Add" pill */}
      {selectedText && selectionRect && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            top: Math.max(selectionRect.top - 44, 8),
            left: Math.min(
              Math.max(selectionRect.left + selectionRect.width / 2, 60),
              (typeof window !== 'undefined' ? window.innerWidth : 400) - 60,
            ),
            transform: 'translateX(-50%)',
          }}
        >
          <button
            className="pointer-events-auto flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--primary)] text-white text-sm font-bold shadow-xl"
            onMouseDown={e => e.preventDefault()}
            onTouchStart={e => e.preventDefault()}
            onTouchEnd={e => { e.preventDefault(); addWord(); }}
            onClick={addWord}
          >
            + Add
          </button>
        </div>
      )}

      {/* Collected word list */}
      {wordList.length > 0 && (
        <div className="card mx-4 space-y-1">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-sm text-[var(--text)]">Collected words</h2>
            <button onClick={() => setWordList([])} className="text-xs text-[var(--danger)] hover:underline">
              Clear all
            </button>
          </div>
          {wordList.map((w, i) => (
            <div key={i} className="flex items-center gap-2 py-1.5 border-b border-[var(--border)] last:border-0">
              <span className="text-xs text-[var(--text-muted)] w-5 shrink-0 text-right">{i + 1}.</span>
              <span className="flex-1 text-sm text-[var(--text)] font-medium">{w}</span>
              <button
                onClick={() => removeWord(i)}
                className="text-[var(--text-muted)] hover:text-[var(--danger)] text-xs px-1 transition-colors"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* AI Prompt */}
      {wordList.length > 0 && (
        <div className="card mx-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm text-[var(--text)]">AI Prompt</h2>
            <span className="text-xs text-[var(--text-muted)]">Copy → paste into ChatGPT or Claude</span>
          </div>
          <pre className="text-xs text-[var(--text-muted)] bg-[var(--surface-2)] rounded-xl p-3 whitespace-pre-wrap font-mono leading-relaxed max-h-52 overflow-y-auto">
            {prompt}
          </pre>
          <button
            onClick={copyPrompt}
            className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${copied ? 'bg-green-500 text-white' : 'btn-primary'}`}
          >
            {copied ? '✓ Copied!' : '📋 Copy Prompt'}
          </button>
        </div>
      )}

      {/* Import AI result */}
      {wordList.length > 0 && (
        <div className="card mx-4 mb-4 space-y-3">
          <button
            onClick={() => setShowImport(v => !v)}
            className="w-full flex items-center justify-between text-sm font-semibold text-[var(--text)]"
          >
            <span>📥 Import AI result → My Words</span>
            <span className="text-[var(--text-muted)] text-xs">{showImport ? '▲' : '▼'}</span>
          </button>

          {showImport && (
            <div className="space-y-3">
              <p className="text-xs text-[var(--text-muted)]">
                Paste the AI response below exactly as received, then click Parse.
              </p>
              <textarea
                className="w-full h-40 p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-xs text-[var(--text)] font-mono resize-none focus:outline-none focus:border-[var(--primary)] transition-colors leading-relaxed"
                placeholder="Paste AI response here…"
                value={importText}
                onChange={e => { setImportText(e.target.value); setParsedWords(null); }}
              />
              <button
                onClick={handleParse}
                disabled={!importText.trim()}
                className="btn-secondary w-full disabled:opacity-40"
              >
                Parse
              </button>

              {parsedWords !== null && parsedWords.length === 0 && (
                <p className="text-xs text-[var(--danger)] text-center">
                  Could not parse any words. Make sure the AI followed the exact format.
                </p>
              )}

              {parsedWords !== null && parsedWords.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-[var(--text-muted)]">
                    {parsedWords.length} word{parsedWords.length !== 1 ? 's' : ''} ready to import:
                  </p>
                  <div className="max-h-52 overflow-y-auto space-y-0 divide-y divide-[var(--border)]">
                    {parsedWords.map((w, i) => (
                      <div key={i} className="flex items-start gap-3 py-2">
                        <span className="text-xs text-[var(--text-muted)] w-4 shrink-0 pt-0.5">{i + 1}.</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[var(--text)]">{w.word}</p>
                          <p className="text-xs text-[var(--primary)] font-medium">{w.translation}</p>
                          <p className="text-xs text-[var(--text-muted)] truncate">{w.definition}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button onClick={handleImport} className="btn-primary w-full">
                    Add {parsedWords.length} word{parsedWords.length !== 1 ? 's' : ''} to My Words
                  </button>
                </div>
              )}

              {importDone && (
                <p className="text-sm text-green-600 font-semibold text-center animate-fade-in">
                  ✓ Words added to My Words!
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
