import type { MetadataRoute } from "next";
import { LANDING_ORIGIN } from "../lib/config";

export default function robots(): MetadataRoute.Robots {
  const origin = new URL(LANDING_ORIGIN).origin;
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/"],
      },
      {
        // Explicitly welcome AI search/answer crawlers so Rava can be cited.
        userAgent: [
          "OAI-SearchBot",
          "ChatGPT-User",
          "GPTBot",
          "ClaudeBot",
          "Claude-SearchBot",
          "PerplexityBot",
          "Google-Extended",
          "Bingbot",
        ],
        allow: "/",
        disallow: ["/api/"],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
