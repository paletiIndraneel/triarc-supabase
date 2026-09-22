import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare Pages serves the static `out/` build; there is no Node/Workers
  // server for on-demand rendering or the next/image optimizer.
  output: "export",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
