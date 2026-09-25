import type { MetadataRoute } from "next";
import { site } from "@/data/site";

export default function robots(): MetadataRoute.Robots {
  return {
   rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/signin"],
      },
      {
        userAgent: [
          "GPTBot",
          "ClaudeBot",
          "CCBot",
          "Google-Extended",
          "Bytespider",
          "Applebot-Extended",
        ],
        disallow: "/",
      },
    ],
    sitemap: `${site.url}/sitemap.xml`,
  };
}
