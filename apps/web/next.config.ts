import type { NextConfig } from "next";

// Security headers that don't need a per-request nonce. CSP lives in proxy.ts.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig: NextConfig = {
  // cacheComponents/PPR are off on purpose: nonce CSP (SECURITY.md §12) needs dynamic rendering.
  poweredByHeader: false,
  turbopack: {
    rules: {
      // Tailwind only for the global sheet; *.module.css must stay CSS modules.
      "globals.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  async rewrites() {
    const api = process.env.API_ORIGIN ?? "http://127.0.0.1:8000";
    return [{ source: "/api/v1/:path*", destination: `${api}/api/v1/:path*` }];
  },
};

export default nextConfig;
