import type { MetadataRoute } from "next";
import { site } from "@/data/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = site.url;
  const routes: { path: string; lastModified: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
    { path: "/", lastModified: "2026-09-24", priority: 1, changeFrequency: "weekly" },
    { path: "/about", lastModified: "2026-09-24", priority: 0.6, changeFrequency: "monthly" },
    { path: "/contact", lastModified: "2026-09-24", priority: 0.6, changeFrequency: "monthly" },
    { path: "/charging-solutions", lastModified: "2026-09-25", priority: 0.8, changeFrequency: "monthly" },
    { path: "/charging-solutions/ev-charging", lastModified: "2026-09-25", priority: 0.7, changeFrequency: "monthly" },
    { path: "/charging-solutions/dc-fast-charging", lastModified: "2026-09-25", priority: 0.7, changeFrequency: "monthly" },
    { path: "/charging-solutions/charger-installation", lastModified: "2026-09-25", priority: 0.7, changeFrequency: "monthly" },
    { path: "/charging-solutions/commercial-ev-charging", lastModified: "2026-09-25", priority: 0.7, changeFrequency: "monthly" },
    { path: "/charging-solutions/fleet-charging", lastModified: "2026-09-25", priority: 0.7, changeFrequency: "monthly" },
    { path: "/locations/bhadrachalam", lastModified: "2026-09-25", priority: 0.9, changeFrequency: "monthly" },
    { path: "/ev-station/triarc-ev-hub-bhadrachalam", lastModified: "2026-09-25", priority: 0.9, changeFrequency: "monthly" },
  ];

  return routes.map((route) => ({
    url: `${base}${route.path}`,
    lastModified: route.lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
