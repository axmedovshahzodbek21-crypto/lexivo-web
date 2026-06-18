import { NextRequest, NextResponse } from 'next/server';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '8582829798:AAFMuhQZBOBva-9rZx5q65DTNCctQKX6AiM';
const OWNER_ID  = '8639830756';

async function sendMessage(chatId: string | number, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: String(chatId), text }),
  });
  const json = await res.json();
  console.log(`sendMessage to ${chatId}: ok=${json.ok} err=${json.description ?? ''}`);
  return json;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = body?.message;
    if (!message) return NextResponse.json({ ok: true });

    const fromId   = message.from?.id;
    const fromName = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(' ') || 'Unknown';
    const username = message.from?.username ? `@${message.from.username}` : 'no username';
    const text     = message.text ?? '[non-text message]';

    // Auto-reply to user first
    await sendMessage(fromId, `Your message has been received! We'll get back to you as soon as possible.\n\n— Lexivo Team`);

    // Forward to owner
    await sendMessage(OWNER_ID, `📩 New support message\n👤 ${fromName} (${username})\n🆔 ${fromId}\n\n${text}`);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Telegram webhook error:', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
