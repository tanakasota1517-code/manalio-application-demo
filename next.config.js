const supabaseConnectOrigin = getSupabaseConnectOrigin();

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      ["connect-src 'self'", supabaseConnectOrigin].filter(Boolean).join(" "),
      "object-src 'none'",
      "frame-src 'none'",
      "worker-src 'self'",
      "manifest-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self' mailto:",
    ].join("; "),
  },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const noStoreHeaders = [
  { key: "Cache-Control", value: "no-store, max-age=0" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/api/:path*",
        headers: noStoreHeaders,
      },
      {
        source: "/login",
        headers: noStoreHeaders,
      },
      {
        source: "/app",
        headers: noStoreHeaders,
      },
      {
        source: "/workspace",
        headers: noStoreHeaders,
      },
    ];
  },
};

module.exports = nextConfig;

function getSupabaseConnectOrigin() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  try {
    return rawUrl ? new URL(rawUrl).origin : "";
  } catch {
    return "";
  }
}
