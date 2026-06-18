import { NextRequest, NextResponse } from 'next/server';

async function sendMessage(chatId: string | number, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
}

export async function POST(req: NextRequest) {
  try {
    const ownerId = process.env.TELEGRAM_OWNER_CHAT_ID;
    const body = await req.json();
    const message = body?.message;
    if (!message) return NextResponse.json({ ok: true });

    const fromId   = message.from?.id;
    const fromName = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(' ') || 'Unknown';
    const username = message.from?.username ? `@${message.from.username}` : 'no username';
    const text     = message.text ?? '[non-text message]';

    // Forward to owner
    await sendMessage(
      ownerId!,
      `📩 <b>New support message</b>\n👤 ${fromName} (${username})\n🆔 ${fromId}\n\n${text}`,
    );

    // Auto-reply to user
    await sendMessage(
      fromId,
      `✅ Thank you for reaching out! Your message has been received and we'll get back to you as soon as possible.\n\n— Lexivo Team`,
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Telegram webhook error:', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
