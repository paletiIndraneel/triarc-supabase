import type { MetadataRoute } from "next";
import { site } from "@/data/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = site.url;
  const now = new Date();

  const routes: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
    { path: "/", priority: 1, changeFrequency: "weekly" },
    { path: "/about", priority: 0.6, changeFrequency: "monthly" },
    { path: "/contact", priority: 0.6, changeFrequency: "monthly" },
    { path: "/solutions", priority: 0.8, changeFrequency: "monthly" },
    { path: "/solutions/ev-charging", priority: 0.7, changeFrequency: "monthly" },
    { path: "/solutions/dc-fast-charging", priority: 0.7, changeFrequency: "monthly" },
    { path: "/solutions/charger-installation", priority: 0.7, changeFrequency: "monthly" },
    { path: "/solutions/commercial-charging", priority: 0.7, changeFrequency: "monthly" },
    { path: "/solutions/fleet-charging", priority: 0.7, changeFrequency: "monthly" },
    { path: "/locations/bhadrachalam", priority: 0.9, changeFrequency: "monthly" },
    { path: "/stations/triarc-ev-hub-bhadrachalam", priority: 0.9, changeFrequency: "monthly" },
  ];

  return routes.map((route) => ({
    url: `${base}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
