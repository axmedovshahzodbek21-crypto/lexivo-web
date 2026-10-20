// Class chat: one conversation per class + student. Teacher messages are
// class_notes rows (also written by Insights "Send" and the dashboard Notes
// button); student messages are class_replies rows — see migration
// 20261020000001_class_chat.sql. No Realtime: an open chat polls for rows
// newer than the last one it has, which keeps this on the free plan.
import { supabase } from '@/lib/supabase';

export const CHAT_POLL_MS = 10_000;
export const STUDENT_MESSAGE_MAX = 500;
export const TEACHER_MESSAGE_MAX = 1000;

export interface ChatMessage {
  id: string;
  from: 'teacher' | 'student';
  message: string;
  created_at: string;
  read_at: string | null;
}

type Row = { id: string; message: string; created_at: string; read_at: string | null };

// The conversation, oldest first — or only what's newer than `since`.
export async function loadThread(classId: string, studentId: string, since?: string): Promise<ChatMessage[]> {
  let notes = supabase.from('class_notes').select('id, message, created_at, read_at')
    .eq('class_id', classId).eq('student_id', studentId);
  let replies = supabase.from('class_replies').select('id, message, created_at, read_at')
    .eq('class_id', classId).eq('student_id', studentId);
  if (since) { notes = notes.gt('created_at', since); replies = replies.gt('created_at', since); }
  const [{ data: n }, { data: r }] = await Promise.all([
    notes.order('created_at', { ascending: false }).limit(200),
    replies.order('created_at', { ascending: false }).limit(200),
  ]);
  return [
    ...((n ?? []) as Row[]).map(x => ({ ...x, from: 'teacher' as const })),
    ...((r ?? []) as Row[]).map(x => ({ ...x, from: 'student' as const })),
  ].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

// read_at for the given message ids that have been read.
export async function loadReadAt(table: 'class_notes' | 'class_replies', ids: string[]): Promise<Record<string, string>> {
  const { data } = await supabase.from(table).select('id, read_at').in('id', ids).not('read_at', 'is', null);
  return Object.fromEntries(((data ?? []) as { id: string; read_at: string }[]).map(r => [r.id, r.read_at]));
}

export async function sendTeacherMessage(classId: string, studentId: string, teacherId: string, text: string): Promise<'ok' | 'failed'> {
  const { error } = await supabase.from('class_notes').insert({
    class_id: classId, student_id: studentId, teacher_id: teacherId, message: text.trim().slice(0, TEACHER_MESSAGE_MAX),
  });
  return error ? 'failed' : 'ok';
}

export async function sendStudentMessage(classId: string, studentId: string, text: string): Promise<'ok' | 'limit' | 'failed'> {
  const { error } = await supabase.from('class_replies').insert({
    class_id: classId, student_id: studentId, message: text.trim().slice(0, STUDENT_MESSAGE_MAX),
  });
  if (!error) return 'ok';
  return error.message?.includes('daily_message_limit') ? 'limit' : 'failed';
}

// Marks the other side's messages read: a student reads the teacher's
// notes, a teacher reads one student's replies.
export function markThreadRead(classId: string, studentId: string, as: 'teacher' | 'student') {
  void (as === 'student'
    ? supabase.rpc('mark_class_notes_read', { p_class_id: classId })
    : supabase.rpc('mark_class_replies_read', { p_class_id: classId, p_student_id: studentId }));
}

export interface InboxEntry { last: ChatMessage | null; unread: number; }

// Teacher: last message and unread student messages per student.
export async function loadInbox(classId: string): Promise<Record<string, InboxEntry>> {
  const [{ data: n }, { data: r }] = await Promise.all([
    supabase.from('class_notes').select('id, student_id, message, created_at, read_at')
      .eq('class_id', classId).order('created_at', { ascending: false }).limit(300),
    supabase.from('class_replies').select('id, student_id, message, created_at, read_at')
      .eq('class_id', classId).order('created_at', { ascending: false }).limit(300),
  ]);
  const out: Record<string, InboxEntry> = {};
  const add = (row: Row & { student_id: string }, from: ChatMessage['from']) => {
    const e = (out[row.student_id] ??= { last: null, unread: 0 });
    if (!e.last || row.created_at > e.last.created_at) e.last = { ...row, from };
    if (from === 'student' && !row.read_at) e.unread++;
  };
  for (const row of (n ?? []) as (Row & { student_id: string })[]) add(row, 'teacher');
  for (const row of (r ?? []) as (Row & { student_id: string })[]) add(row, 'student');
  return out;
}

export async function setChatEnabled(classId: string, enabled: boolean): Promise<boolean> {
  const { error } = await supabase.rpc('set_class_chat_enabled', { p_class_id: classId, p_enabled: enabled });
  return !error;
}

// Calls `fn` every CHAT_POLL_MS while the tab is visible; returns a stop function.
export function pollWhileVisible(fn: () => void, ms = CHAT_POLL_MS): () => void {
  const id = setInterval(() => { if (document.visibilityState === 'visible') fn(); }, ms);
  const onVisible = () => { if (document.visibilityState === 'visible') fn(); };
  document.addEventListener('visibilitychange', onVisible);
  return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
}
