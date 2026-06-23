import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const BOT_TOKEN      = process.env.TELEGRAM_BOT_TOKEN;
const OWNER_ID       = process.env.TELEGRAM_OWNER_ID ?? '8639830756';
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

async function sendMessage(chatId: string | number, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: String(chatId), text }),
  });
  return res.json();
}

export async function POST(req: NextRequest) {
  if (!BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN env var is not set');
    return NextResponse.json({ ok: true });
  }

  // Verify the request is genuinely from Telegram
  if (WEBHOOK_SECRET) {
    const incoming = req.headers.get('x-telegram-bot-api-secret-token');
    if (incoming !== WEBHOOK_SECRET) {
      console.warn('Telegram webhook: invalid secret token');
      return NextResponse.json({ ok: true }); // Return 200 so attacker learns nothing
    }
  }

  try {
    const body = await req.json();
    const message = body?.message;
    if (!message) return NextResponse.json({ ok: true });

    const fromId   = message.from?.id;
    const fromName = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(' ') || 'Unknown';
    const username = message.from?.username ?? null;
    const text     = (message.text ?? '').trim();
    const isOwner  = String(fromId) === OWNER_ID;

    // Save user to database
    await supabase.from('bot_users').upsert(
      { chat_id: fromId, first_name: fromName, username, last_seen: new Date().toISOString() },
      { onConflict: 'chat_id' },
    );

    // ── User commands ──────────────────────────────────────────────────────────

    if (text === '/start') {
      await sendMessage(fromId,
        `👋 Welcome to Lexivo Support!\n\nHave a question or feedback? Just send it here and our team will get back to you as soon as possible.\n\n📚 Learn vocabulary at lexivo-web-six.vercel.app`
      );
      return NextResponse.json({ ok: true });
    }

    // ── Owner commands ─────────────────────────────────────────────────────────

    if (isOwner && message.reply_to_message) {
      const repliedText = message.reply_to_message.text ?? '';
      const idMatch = repliedText.match(/🆔\s*(\d+)/);
      if (idMatch) {
        const targetId = idMatch[1];
        await sendMessage(targetId, `💬 Reply from Lexivo Support:\n\n${text}`);
        await sendMessage(OWNER_ID, `✅ Reply sent.`);
        return NextResponse.json({ ok: true });
      }
    }

    if (isOwner && text.startsWith('/broadcast ')) {
      const broadcastText = text.slice('/broadcast '.length).trim();
      if (!broadcastText) return NextResponse.json({ ok: true });

      // Rate limit: max 1 broadcast per 5 minutes
      const { data: ownerRow } = await supabase
        .from('bot_users')
        .select('last_broadcast_at')
        .eq('chat_id', fromId)
        .maybeSingle();
      const lastBroadcast = ownerRow?.last_broadcast_at ? new Date(ownerRow.last_broadcast_at) : null;
      const minutesSinceLast = lastBroadcast ? (Date.now() - lastBroadcast.getTime()) / 60000 : 999;
      if (minutesSinceLast < 5) {
        const remaining = Math.ceil(5 - minutesSinceLast);
        await sendMessage(OWNER_ID, `⏳ Rate limit: wait ${remaining} more minute${remaining !== 1 ? 's' : ''} before next broadcast.`);
        return NextResponse.json({ ok: true });
      }

      // Fetch targets and send with delay to respect Telegram's 30 msg/sec limit
      const { data: users } = await supabase.from('bot_users').select('chat_id');
      const targets = (users ?? []).filter(u => String(u.chat_id) !== OWNER_ID);
      let sent = 0;
      for (const u of targets) {
        const r = await sendMessage(u.chat_id, broadcastText);
        if (r.ok) sent++;
        await new Promise(resolve => setTimeout(resolve, 50)); // 20 msgs/sec — under Telegram's 30/sec limit
      }

      // Record timestamp and log
      await supabase
        .from('bot_users')
        .update({ last_broadcast_at: new Date().toISOString() })
        .eq('chat_id', fromId);
      await supabase.from('bot_broadcasts').insert({
        sent_by: fromId,
        message: broadcastText,
        recipient_count: sent,
        sent_at: new Date().toISOString(),
      }).throwOnError().catch(() => {}); // Log if table exists, silently skip if not

      await sendMessage(OWNER_ID, `✅ Broadcast sent to ${sent} user${sent !== 1 ? 's' : ''}.`);
      return NextResponse.json({ ok: true });
    }

    if (isOwner && text === '/stats') {
      const { count } = await supabase.from('bot_users').select('*', { count: 'exact', head: true });
      await sendMessage(OWNER_ID, `📊 Bot Stats\n\n👥 Total users: ${count ?? 0}`);
      return NextResponse.json({ ok: true });
    }

    if (isOwner && text === '/users') {
      const { data: users } = await supabase.from('bot_users').select('first_name,username,last_seen').order('last_seen', { ascending: false }).limit(20);
      if (!users || users.length === 0) {
        await sendMessage(OWNER_ID, `No users yet.`);
      } else {
        const lines = users.map((u, i) => {
          const name = u.first_name ?? 'Unknown';
          const uname = u.username ? ` (@${u.username})` : '';
          const date = new Date(u.last_seen).toLocaleDateString();
          return `${i + 1}. ${name}${uname} — ${date}`;
        });
        await sendMessage(OWNER_ID, `👥 Recent users (last 20):\n\n${lines.join('\n')}`);
      }
      return NextResponse.json({ ok: true });
    }

    if (isOwner && text === '/help') {
      await sendMessage(OWNER_ID,
        `🛠 Admin Commands\n\n` +
        `/stats — total number of users\n` +
        `/users — list of last 20 users\n` +
        `/broadcast <message> — send to all users (max once per 5 min)\n` +
        `Reply to a message — send reply to that user`
      );
      return NextResponse.json({ ok: true });
    }

    // ── Regular support message ────────────────────────────────────────────────

    if (!isOwner) {
      await sendMessage(fromId, `Your message has been received! We'll get back to you as soon as possible.\n\n— Lexivo Team`);
    }

    const usernameDisplay = username ? `@${username}` : 'no username';
    await sendMessage(OWNER_ID, `📩 New support message\n👤 ${fromName} (${usernameDisplay})\n🆔 ${fromId}\n\n${text}`);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Telegram webhook error:', err);
    return NextResponse.json({ ok: true }); // Always 200 — non-200 causes Telegram to retry infinitely
  }
}
