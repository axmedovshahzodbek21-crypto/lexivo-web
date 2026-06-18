import { NextRequest, NextResponse } from 'next/server';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '8582829798:AAFMuhQZBOBva-9rZx5q65DTNCctQKX6AiM';
const OWNER_ID  = process.env.TELEGRAM_OWNER_CHAT_ID ?? '8639830756';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function sendMessage(chatId: string | number, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
  const json = await res.json();
  console.log(`sendMessage to ${chatId}:`, JSON.stringify(json));
  return json;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = body?.message;
    if (!message) return NextResponse.json({ ok: true });

    const fromId   = message.from?.id;
    const fromName = esc([message.from?.first_name, message.from?.last_name].filter(Boolean).join(' ') || 'Unknown');
    const username = message.from?.username ? `@${esc(message.from.username)}` : 'no username';
    const text     = esc(message.text ?? '[non-text message]');

    await sendMessage(
      OWNER_ID,
      `📩 <b>New support message</b>\n👤 ${fromName} (${username})\n🆔 ${fromId}\n\n${text}`,
    );

    await sendMessage(
      fromId,
      `✅ Your message has been received! We'll get back to you as soon as possible.\n\n— Lexivo Team`,
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Telegram webhook error:', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
