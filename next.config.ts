import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  fallbacks: { document: "/offline" },
  workboxOptions: {
    disableDevLogs: true,
    skipWaiting: true,
    clientsClaim: true,
    cleanupOutdatedCaches: true,
    cacheId: "lexivo-v3",
    runtimeCaching: [
      {
        urlPattern: ({ sameOrigin, url }: { sameOrigin: boolean; url: URL }) =>
          sameOrigin && url.pathname.startsWith('/api/auth/'),
        handler: 'NetworkOnly' as const,
      },
    ],
  },
});

const csp = [
  "default-src 'self'",
  // 'unsafe-inline' is required for Next.js App Router hydration scripts.
  // Without a nonce infrastructure this can't be removed, but the tight
  // connect-src below still blocks XSS data exfiltration to arbitrary hosts.
  "script-src 'self' 'unsafe-inline' https://cdn.onesignal.com",
  // Allow fetch/WebSocket to Supabase and OneSignal only
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.onesignal.com",
  // Supabase Storage avatars are served over HTTPS; data: for base64 previews
  "img-src 'self' data: blob: https:",
  // Tailwind and CSS-in-JS need unsafe-inline for style attributes
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  // Service worker + PWA workbox uses blob: workers
  "worker-src 'self' blob:",
  // Redundant with X-Frame-Options but respected by modern browsers
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'X-Frame-Options',        value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-XSS-Protection',       value: '1; mode=block' },
  { key: 'Referrer-Policy',        value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',     value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'Content-Security-Policy', value: csp },
];

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  devIndicators: {
    position: 'bottom-right',
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default withPWA(nextConfig);
