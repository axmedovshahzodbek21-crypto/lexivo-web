// Class chat: one conversation per class + student. Teacher messages are
// class_notes rows (also written by Insights "Send" and the dashboard Notes
// button); student messages are class_replies rows — see migration
// 20261020000001_class_chat.sql. No Realtime: an open chat polls for rows
// newer than the last one it has, which keeps this on the free plan.
import { supabase } from '@/lib/supabase';

export const CHAT_POLL_MS = 10_000;
export const STUDENT_MESSAGE_MAX = 500;
export const TEACHER_MESSAGE_MAX = 1000;
// Photos (migration 20261102000002): private bucket, deleted after 30 days.
export const PHOTO_BUCKET = 'chat-photos';
export const PHOTO_MAX_AGE_DAYS = 30;
const PHOTO_MAX_SIDE = 1280;
const PHOTO_QUALITY = 0.75;

export interface ChatMessage {
  id: string;
  from: 'teacher' | 'student';
  message: string;
  image_path: string | null;
  created_at: string;
  read_at: string | null;
}

type Row = { id: string; message: string; image_path: string | null; created_at: string; read_at: string | null };

export const photoExpired = (m: ChatMessage) =>
  Date.now() - new Date(m.created_at).getTime() > PHOTO_MAX_AGE_DAYS * 86_400_000;

// The conversation, oldest first — or only what's newer than `since`.
export async function loadThread(classId: string, studentId: string, since?: string): Promise<ChatMessage[]> {
  let notes = supabase.from('class_notes').select('id, message, image_path, created_at, read_at')
    .eq('class_id', classId).eq('student_id', studentId);
  let replies = supabase.from('class_replies').select('id, message, image_path, created_at, read_at')
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

// Shrinks a picked image to a ≤1280px JPEG so a photo is ~150-300 KB.
async function shrinkPhoto(file: File): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', PHOTO_QUALITY));
  } catch {
    return null;
  }
}

// Uploads into the conversation's folder, then posts the message row.
// Teacher rows are class_notes, student rows class_replies (as for text).
export async function sendPhoto(
  classId: string, studentId: string, as: 'teacher' | 'student', myId: string, file: File,
): Promise<'ok' | 'limit' | 'photo_limit' | 'failed'> {
  const blob = await shrinkPhoto(file);
  if (!blob) return 'failed';
  const path = `${classId}/${studentId}/${crypto.randomUUID()}.jpg`;
  const { error: upErr } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
  // The upload policy refuses a student's 11th photo of the day.
  if (upErr) return as === 'student' ? 'photo_limit' : 'failed';
  const { error } = as === 'teacher'
    ? await supabase.from('class_notes').insert({ class_id: classId, student_id: studentId, teacher_id: myId, message: '', image_path: path })
    : await supabase.from('class_replies').insert({ class_id: classId, student_id: studentId, message: '', image_path: path });
  if (!error) return 'ok';
  if (error.message?.includes('daily_photo_limit')) return 'photo_limit';
  return error.message?.includes('daily_message_limit') ? 'limit' : 'failed';
}

// Private bucket → short-lived signed links, cached for the page's life.
const signedUrls = new Map<string, Promise<string | null>>();
export function photoUrl(path: string): Promise<string | null> {
  let p = signedUrls.get(path);
  if (!p) {
    p = supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path, 3600)
      .then(({ data }) => data?.signedUrl ?? null);
    signedUrls.set(path, p);
  }
  return p;
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
    supabase.from('class_notes').select('id, student_id, message, image_path, created_at, read_at')
      .eq('class_id', classId).order('created_at', { ascending: false }).limit(300),
    supabase.from('class_replies').select('id, student_id, message, image_path, created_at, read_at')
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
