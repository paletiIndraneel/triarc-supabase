import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  images: {
    unoptimized: true,
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