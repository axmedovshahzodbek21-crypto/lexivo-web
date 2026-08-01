import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// Max one digest request per class per minute (in-process guard)
const rateLimitMap = new Map<string, number>();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { classId, analytics } = body as {
      classId: string;
      analytics: {
        studentName: string;
        totalSessions: number;
        totalWordsLearned: number;
        avgSessionSeconds: number;
        genuineMasteryPct: number | null;
        speedFlagSessions: number;
      }[];
    };

    if (!classId || !Array.isArray(analytics)) {
      return NextResponse.json({ error: 'Missing classId or analytics' }, { status: 400 });
    }

    const last = rateLimitMap.get(classId) ?? 0;
    if (Date.now() - last < 60_000) {
      return NextResponse.json({ error: 'Rate limit: one digest per minute' }, { status: 429 });
    }
    rateLimitMap.set(classId, Date.now());

    const rows = analytics
      .map(s =>
        `• ${s.studentName}: ${s.totalWordsLearned} words learned across ${s.totalSessions} sessions` +
        (s.avgSessionSeconds ? `, avg ${Math.round(s.avgSessionSeconds / 60)} min/session` : '') +
        (s.genuineMasteryPct != null ? `, ${s.genuineMasteryPct}% gate accuracy` : '') +
        (s.speedFlagSessions > 0 ? ` ⚠️ ${s.speedFlagSessions} speed-flagged session(s)` : '')
      )
      .join('\n');

    const prompt = `You are a language-learning teacher coach. Below is one week of analytics for a class using the Lexivo app.

${rows}

Write a warm, encouraging 3-paragraph weekly digest (max 200 words total):
1. Celebrate the class's top achievements this week.
2. Identify 1-2 students who may need extra support (look for low gate accuracy or speed-flagged sessions).
3. Give one concrete teaching tip for next week based on the data.

Keep the tone friendly and professional. Do not repeat the raw numbers verbatim — paraphrase naturally.`;

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    return NextResponse.json({ digest: text });
  } catch (err) {
    console.error('digest route error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
