import { LANDING_ORIGIN } from "./config";

export const SITE_NAME = "Rava";
export const SITE_TAGLINE = "Scroll. Tap. Buy.";

/** Primary meta description (≤160 chars for SERP) */
export const SITE_DESCRIPTION =
  "Shop from fashion reels in one tap. Rava connects brands with creators and turns viewers into buyers—social commerce, reel-to-checkout, and sales tracking for India and global brands.";

/** Keyword themes for metadata (natural phrases; avoid stuffing in body copy) */
export const SEO_KEYWORDS = [
  "shop from reels",
  "social commerce India",
  "fashion reels shopping",
  "influencer marketing platform",
  "reel to purchase",
  "creator brand marketplace",
  "video shopping app",
  "TikTok shopping alternative",
  "Instagram shopping",
  "one tap checkout",
  "Rava",
  "shopatrava",
] as const;

export function siteUrl(path = ""): string {
  const base = LANDING_ORIGIN.replace(/\/$/, "");
  if (!path) return `${base}/`;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function organizationJsonLd() {
  const url = siteUrl();
  return {
    "@type": "Organization",
    "@id": `${url}#organization`,
    name: SITE_NAME,
    url,
    logo: siteUrl("logo/logo.jpeg"),
    description: SITE_DESCRIPTION,
    sameAs: ["https://app.rava.one/"],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: "shopatrava@gmail.com",
      areaServed: ["IN", "Worldwide"],
      availableLanguage: ["English"],
    },
  };
}

export function websiteJsonLd() {
  const url = siteUrl();
  return {
    "@type": "WebSite",
    "@id": `${url}#website`,
    name: `${SITE_NAME} — ${SITE_TAGLINE}`,
    url,
    description: SITE_DESCRIPTION,
    publisher: { "@id": `${url}#organization` },
    inLanguage: "en",
  };
}

export function softwareApplicationJsonLd() {
  return {
    "@type": "SoftwareApplication",
    name: `${SITE_NAME} Web App`,
    applicationCategory: "ShoppingApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    url: "https://app.rava.one/",
  };
}

export function faqPageJsonLd() {
  return {
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is Rava?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Rava is a fashion and social commerce platform where shoppers discover products through reels and buy in one flow. Brands match with creators; sales and attribution are tracked from reel views to purchase.",
        },
      },
      {
        "@type": "Question",
        name: "How does checkout work on Rava?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Users scroll creator reels, tap products they like, and complete checkout without leaving the experience—reducing friction between discovery and purchase.",
        },
      },
      {
        "@type": "Question",
        name: "Where is Rava available?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Rava is headquartered in Hyderabad, India, and serves brands and shoppers online via the web app at app.rava.one.",
        },
      },
    ],
  };
}

export function jsonLdScriptContent(): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      organizationJsonLd(),
      websiteJsonLd(),
      softwareApplicationJsonLd(),
      faqPageJsonLd(),
    ],
  });
}
