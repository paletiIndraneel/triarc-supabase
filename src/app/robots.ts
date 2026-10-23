import type { MetadataRoute } from "next";
import { BLOCKED_BOTS } from "@/lib/bots";

// The admin is private: every crawler, search engine and AI agent is told to stay out.
// (src/proxy.ts also refuses them, for the ones that ignore this file.)
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", disallow: "/" },
      { userAgent: BLOCKED_BOTS, disallow: "/" },
    ],
  };
}
