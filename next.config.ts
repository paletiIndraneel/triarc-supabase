import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },

  // Baseline security headers. The CSP is limited to directives that cannot affect
  // scripts, styles, images, fonts or API calls (so nothing on the site is blocked):
  // it stops the site being framed, blocks <base>/<object> injection and form hijacking.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
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
      { source: "/solutions", destination: "/charging-solutions", permanent: true },
      { source: "/solutions/ev-charging", destination: "/charging-solutions/ev-charging", permanent: true },
      { source: "/solutions/dc-fast-charging", destination: "/charging-solutions/dc-fast-charging", permanent: true },
      { source: "/solutions/charger-installation", destination: "/charging-solutions/charger-installation", permanent: true },
      { source: "/solutions/commercial-charging", destination: "/charging-solutions/commercial-ev-charging", permanent: true },
      { source: "/solutions/fleet-charging", destination: "/charging-solutions/fleet-charging", permanent: true },
      { source: "/stations/triarc-ev-hub-bhadrachalam", destination: "/ev-station/triarc-ev-hub-bhadrachalam", permanent: true },
    ];
  },
};

export default nextConfig;