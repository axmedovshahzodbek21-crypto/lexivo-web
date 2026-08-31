// Register (or re-register) the Telegram webhook for the support bot.
//
//   node scripts/set-telegram-webhook.mjs [url]
//
// Reads TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET from .env.local (or the
// process env). The secret is passed to Telegram as `secret_token`; it must
// match the TELEGRAM_WEBHOOK_SECRET env var on the deployment or the route
// rejects every update. Pass a url arg to target a preview deployment;
// defaults to production.

import { readFileSync } from 'node:fs';

const DEFAULT_URL = 'https://lexivo-web-nu.vercel.app/api/telegram';

function loadEnvLocal() {
  try {
    for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* no .env.local — rely on process env */ }
}

loadEnvLocal();

const token  = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const url    = process.argv[2] || DEFAULT_URL;

if (!token || !secret) {
  console.error('Missing TELEGRAM_BOT_TOKEN and/or TELEGRAM_WEBHOOK_SECRET.');
  process.exit(1);
}

const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url, secret_token: secret, drop_pending_updates: true }),
});
console.log('setWebhook  →', JSON.stringify(await res.json()));

const info = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
console.log('webhookInfo →', JSON.stringify(await info.json(), null, 2));
