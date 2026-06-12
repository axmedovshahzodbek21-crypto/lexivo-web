'use client';
import { useEffect, useState } from 'react';

interface ExitPromptProps {
  wordsRemaining: number;
  onStay: () => void;
  onLeave: () => void;
}

export default function ExitPrompt({ wordsRemaining, onStay, onLeave }: ExitPromptProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (wordsRemaining > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [wordsRemaining]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 animate-fade-in">
      <div className="bg-white rounded-2xl p-6 mx-4 max-w-sm w-full animate-pop text-center">
        <div className="text-5xl mb-3">⚠️</div>
        <h2 className="text-xl font-bold mb-2">You have {wordsRemaining} words left!</h2>
        <p className="text-[var(--text-muted)] text-sm mb-5">
          Finish the session to save your progress and earn XP.
        </p>
        <div className="flex gap-3">
          <button onClick={onLeave} className="btn-secondary flex-1">Leave anyway</button>
          <button onClick={onStay} className="btn-primary flex-1">Keep going! 🚀</button>
        </div>
      </div>
    </div>
  );
}
