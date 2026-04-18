import type { MetadataRoute } from "next";
import { LANDING_ORIGIN } from "../lib/config";

export default function robots(): MetadataRoute.Robots {
  const origin = new URL(LANDING_ORIGIN).origin;
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/_next/", "/api/"],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
