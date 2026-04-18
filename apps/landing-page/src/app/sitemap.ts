import type { MetadataRoute } from "next";
import { LANDING_ORIGIN } from "../lib/config";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = new URL(LANDING_ORIGIN).origin;
  const now = new Date();
  return [
    {
      url: base,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
