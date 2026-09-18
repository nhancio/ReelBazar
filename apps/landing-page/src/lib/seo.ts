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
  "Instagram shopping alternative",
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
    logo: {
      "@type": "ImageObject",
      url: siteUrl("logo/logo.jpeg"),
      width: 512,
      height: 512,
    },
    description: SITE_DESCRIPTION,
    email: "shopatrava@gmail.com",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Hyderabad",
      addressRegion: "Telangana",
      addressCountry: "IN",
    },
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

export function mobileApplicationJsonLd() {
  return {
    "@type": "MobileApplication",
    name: SITE_NAME,
    applicationCategory: "ShoppingApplication",
    operatingSystem: "iOS, Android, Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    url: "https://app.rava.one/",
    description:
      "Social commerce mobile and web platform enabling instant shopping from curated fashion creator reels.",
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.9",
      ratingCount: "128",
    },
  };
}

export function softwareApplicationJsonLd() {
  return {
    "@type": "SoftwareApplication",
    name: `${SITE_NAME} Social Commerce`,
    applicationCategory: "ShoppingApplication",
    operatingSystem: "Web, iOS, Android",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    url: "https://app.rava.one/",
    featureList: [
      "Fashion-only creator video feed",
      "Instant one-tap product checkout",
      "AI creator-brand audience matching",
      "Real-time reel sales attribution",
    ],
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
          text: "Rava is a fashion and social commerce platform where shoppers discover products through reels and buy in one seamless flow. Brands match with creators, and sales and attribution are tracked directly from reel views to purchase.",
        },
      },
      {
        "@type": "Question",
        name: "How does shopping from fashion reels work on Rava?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Shoppers watch fashion creator reels showing real outfits with tagged products. Tapping on a piece brings up direct checkout without opening external tabs or hunting across websites, removing drop-off between discovery and purchase.",
        },
      },
      {
        "@type": "Question",
        name: "How do creators and brands collaborate on Rava?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Rava matches brands with creators based on category, style niche, and audience demographics. Creators tag brand pieces in their reels, and every purchase is attributed directly to the reel, providing clear ROI for brands and earnings for creators.",
        },
      },
      {
        "@type": "Question",
        name: "Where is Rava available?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Rava is accessible on the web at https://app.rava.one and is available for mobile devices on iOS and Android. Rava operates from Hyderabad, India, serving global creators, brands, and shoppers.",
        },
      },
      {
        "@type": "Question",
        name: "How does Rava protect user data and payments?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Rava uses encrypted payment infrastructure and never stores full payment card numbers. We adhere to transparent privacy standards, never sell user data to third parties, and provide instant account deletion controls.",
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
      mobileApplicationJsonLd(),
      softwareApplicationJsonLd(),
      faqPageJsonLd(),
    ],
  });
}
