import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '8582829798:AAFMuhQZBOBva-9rZx5q65DTNCctQKX6AiM';
const OWNER_ID  = '8639830756';

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
  try {
    const body = await req.json();
    const message = body?.message;
    if (!message) return NextResponse.json({ ok: true });

    const fromId   = message.from?.id;
    const fromName = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(' ') || 'Unknown';
    const username = message.from?.username ?? null;
    const text     = message.text ?? '[non-text message]';

    // Save user to database
    await supabase.from('bot_users').upsert(
      { chat_id: fromId, first_name: fromName, username, last_seen: new Date().toISOString() },
      { onConflict: 'chat_id' },
    );

    // Broadcast command — owner only
    if (String(fromId) === OWNER_ID && text.startsWith('/broadcast ')) {
      const broadcastText = text.slice('/broadcast '.length).trim();
      if (broadcastText) {
        const { data: users } = await supabase.from('bot_users').select('chat_id');
        const targets = (users ?? []).filter(u => String(u.chat_id) !== OWNER_ID);
        let sent = 0;
        for (const u of targets) {
          const r = await sendMessage(u.chat_id, broadcastText);
          if (r.ok) sent++;
        }
        await sendMessage(OWNER_ID, `✅ Broadcast sent to ${sent} user${sent !== 1 ? 's' : ''}.`);
      }
      return NextResponse.json({ ok: true });
    }

    // Auto-reply to user
    if (String(fromId) !== OWNER_ID) {
      await sendMessage(fromId, `Your message has been received! We'll get back to you as soon as possible.\n\n— Lexivo Team`);
    }

    // Forward to owner
    const usernameDisplay = username ? `@${username}` : 'no username';
    await sendMessage(OWNER_ID, `📩 New support message\n👤 ${fromName} (${usernameDisplay})\n🆔 ${fromId}\n\n${text}`);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Telegram webhook error:', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
