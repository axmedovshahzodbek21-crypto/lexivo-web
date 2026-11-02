'use client';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/lib/useTranslation';
import {
  type ChatMessage, STUDENT_MESSAGE_MAX, TEACHER_MESSAGE_MAX,
  loadReadAt, loadThread, markThreadRead, photoExpired, photoUrl, pollWhileVisible,
  sendPhoto, sendStudentMessage, sendTeacherMessage,
} from '@/lib/class-chat';

// A chat photo: signed link from the private bucket; tap opens it full size.
function ChatPhoto({ m, expiredLabel }: { m: ChatMessage; expiredLabel: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const expired = photoExpired(m);
  useEffect(() => {
    if (!m.image_path || expired) return;
    let cancelled = false;
    photoUrl(m.image_path).then(u => { if (!cancelled) setUrl(u); });
    return () => { cancelled = true; };
  }, [m.image_path, expired]);
  if (expired) return <p className="text-sm italic opacity-70">📷 {expiredLabel}</p>;
  if (!url) return <div className="w-48 h-32 rounded-xl animate-pulse" style={{ background: 'rgba(127,127,127,0.25)' }} />;
  return (
    <a href={url} target="_blank" rel="noreferrer">
      {/* eslint-disable-next-line @next/next/no-img-element -- signed private-bucket URL, not optimizable */}
      <img src={url} alt="" className="rounded-xl max-h-72 max-w-full object-contain" />
    </a>
  );
}

function timeLabel(iso: string) {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return sameDay ? time : `${d.toLocaleDateString([], { day: '2-digit', month: '2-digit' })} ${time}`;
}

// One class + student conversation. `as` is who is looking at it; `canSend`
// is false when the student's class has chat off (they can still read).
export default function ChatThread({ classId, studentId, as, myId, canSend, otherName }: {
  classId: string; studentId: string; as: 'teacher' | 'student'; myId: string; canSend: boolean; otherName: string;
}) {
  const t = useTranslation().classChat;
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'limit' | 'photo_limit' | 'failed'>('idle');
  const fileRef = useRef<HTMLInputElement>(null);
  const lastRef = useRef<string | undefined>(undefined);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<ChatMessage[] | null>(null);
  const max = as === 'teacher' ? TEACHER_MESSAGE_MAX : STUDENT_MESSAGE_MAX;

  // Only rows newer than the last one we have — a poll is usually empty.
  useEffect(() => {
    let cancelled = false;
    lastRef.current = undefined;
    const merge = (fresh: ChatMessage[]) => {
      if (cancelled || fresh.length === 0) return;
      lastRef.current = fresh[fresh.length - 1].created_at;
      setMessages(prev => {
        const seen = new Set((prev ?? []).map(m => m.id));
        return [...(prev ?? []), ...fresh.filter(m => !seen.has(m.id))];
      });
      if (fresh.some(m => m.from !== as)) markThreadRead(classId, studentId, as);
    };
    loadThread(classId, studentId).then(all => {
      if (cancelled) return;
      setMessages(all);
      if (all.length > 0) lastRef.current = all[all.length - 1].created_at;
      if (all.some(m => m.from !== as && !m.read_at)) markThreadRead(classId, studentId, as);
    });
    const stop = pollWhileVisible(() => {
      loadThread(classId, studentId, lastRef.current).then(merge);
      // My messages not yet seen: ask only whether they've been read since.
      const unseen = (messagesRef.current ?? []).filter(m => m.from === as && !m.read_at).map(m => m.id);
      if (unseen.length > 0) {
        loadReadAt(as === 'teacher' ? 'class_notes' : 'class_replies', unseen).then(read => {
          if (cancelled || Object.keys(read).length === 0) return;
          setMessages(prev => (prev ?? []).map(m => (read[m.id] ? { ...m, read_at: read[m.id] } : m)));
        });
      }
    });
    return () => { cancelled = true; stop(); };
  }, [classId, studentId, as]);

  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: 'end' }); }, [messages?.length]);

  const send = async () => {
    const body = text.trim();
    if (!body || state === 'sending') return;
    setState('sending');
    const res = as === 'teacher'
      ? await sendTeacherMessage(classId, studentId, myId, body)
      : await sendStudentMessage(classId, studentId, body);
    if (res !== 'ok') { setState(res); return; }
    setText('');
    setState('idle');
    await refresh();
  };

  const sendPicked = async (file: File | undefined) => {
    if (!file || state === 'sending') return;
    setState('sending');
    const res = await sendPhoto(classId, studentId, as, myId, file);
    if (res !== 'ok') { setState(res); return; }
    setState('idle');
    await refresh();
  };

  const refresh = async () => {
    const fresh = await loadThread(classId, studentId, lastRef.current);
    if (fresh.length > 0) {
      lastRef.current = fresh[fresh.length - 1].created_at;
      setMessages(prev => {
        const seen = new Set((prev ?? []).map(m => m.id));
        return [...(prev ?? []), ...fresh.filter(m => !seen.has(m.id))];
      });
    }
  };

  return (
    <div className="card flex flex-col" style={{ padding: 0, height: 'min(70vh, 640px)' }}>
      <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-2">
        {messages === null ? (
          <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" /></div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] text-center py-10">{t.empty}</p>
        ) : messages.map(m => {
          const mine = m.from === as;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className="max-w-[80%] rounded-2xl px-3.5 py-2"
                style={mine
                  ? { background: 'var(--primary)', color: '#fff', borderBottomRightRadius: 6 }
                  : { background: 'var(--surface-2)', color: 'var(--text)', borderBottomLeftRadius: 6 }}
              >
                {!mine && <p className="text-[10px] font-bold opacity-70 mb-0.5">{otherName}</p>}
                {m.image_path && <ChatPhoto m={m} expiredLabel={t.photoExpired} />}
                {m.message && <p className="text-sm whitespace-pre-wrap break-words">{m.message}</p>}
                <p className={`text-[10px] mt-0.5 text-right ${mine ? 'text-white/70' : 'text-[var(--text-muted)]'}`}>
                  {timeLabel(m.created_at)}{mine && m.read_at ? ` · ${t.seen}` : ''}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {canSend && (
        <div className="border-t border-[var(--border)] p-3 space-y-1.5">
          <div className="flex items-end gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => { void sendPicked(e.target.files?.[0]); e.target.value = ''; }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={state === 'sending'}
              className="text-lg px-2.5 py-1.5 rounded-xl disabled:opacity-50"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
              aria-label={t.sendPhoto}
              title={t.sendPhoto}
            >
              📷
            </button>
            <textarea
              value={text}
              onChange={e => { setText(e.target.value.slice(0, max)); if (state !== 'sending') setState('idle'); }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
              rows={1}
              placeholder={t.placeholder}
              className="flex-1 text-sm rounded-xl px-3 py-2 resize-none text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--primary)]"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', maxHeight: 120 }}
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={!text.trim() || state === 'sending'}
              className="text-sm font-bold text-white px-4 py-2 rounded-xl disabled:opacity-50"
              style={{ background: 'var(--primary)' }}
            >
              {t.send}
            </button>
          </div>
          <div className="flex justify-between text-[10px] text-[var(--text-muted)]">
            <span>
              {state === 'limit' ? <span style={{ color: 'var(--danger)' }}>{t.limitReached}</span>
                : state === 'photo_limit' ? <span style={{ color: 'var(--danger)' }}>{t.photoLimitReached}</span>
                : state === 'failed' ? <span style={{ color: 'var(--danger)' }}>{t.sendFailed}</span>
                : t.updatesHint}
            </span>
            <span>{text.length}/{max}</span>
          </div>
        </div>
      )}
    </div>
  );
}
