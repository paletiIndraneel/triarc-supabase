import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  // Inlined at build time so browser code can read them without the NEXT_PUBLIC_ prefix.
  // shortcut: falls back to the old NEXT_PUBLIC_ names; drop once every env uses the new ones.
  env: {
    SUPABASE_URL: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    SUPABASE_PUBLISHABLE_KEY:
      process.env.SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      "",
  },

  images: { unoptimized: true },

  // Baseline security headers. The CSP is limited to directives that cannot affect
  // scripts, styles, images, fonts or API calls (so nothing on the site is blocked):
  // it stops the site being framed, blocks <base>/<object> injection and form hijacking.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Private admin: keep every page and API out of search engines.
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate, noai, noimageai" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), payment=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
          },
        ],
      },
    ];
  },

  async redirects() {
    return [
      // The admin is the whole app, served at the root; old /admin links (and /admin/billing etc.) land there.
      { source: "/admin", destination: "/", permanent: false },
      { source: "/admin/:path+", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;