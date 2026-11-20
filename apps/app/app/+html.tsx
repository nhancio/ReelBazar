import { ScrollViewStyleReset } from 'expo-router/html';
import type { ReactNode } from 'react';

/**
 * Web-only: configures the root HTML document for the Expo web export. This runs in Node at
 * build time and has no access to the DOM or browser APIs.
 */
export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />

        <title>Rava — Shop From Fashion Reels</title>
        <meta
          name="description"
          content="Shop fashion directly from creator reels in one tap. Discover curated drops, AI styling, and instant checkout on Rava."
        />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Rava" />
        <meta property="og:title" content="Rava — Shop From Fashion Reels" />
        <meta
          property="og:description"
          content="Shop fashion directly from creator reels in one tap on Rava."
        />
        <meta property="og:url" content="https://app.rava.one/" />
        <meta property="og:image" content="https://rava.one/logo/logo.jpeg" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Rava — Shop From Fashion Reels" />
        <meta
          name="twitter:description"
          content="Shop fashion directly from creator reels in one tap on Rava."
        />
        <meta name="twitter:image" content="https://rava.one/logo/logo.jpeg" />

        {/* PWA — the Vite build shipped an installable app via vite-plugin-pwa, and
            public/site.webmanifest already exists at the repo root. */}
        <meta name="theme-color" content="#08080a" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Rava" />

        <link rel="icon" href="/favicon.ico" sizes="any" />

        {/* Makes ScrollView behave like it does on native rather than scrolling the body. */}
        <ScrollViewStyleReset />

        {/* Raw CSS escape hatch so the page background never flashes white before the React
            tree paints — the old globals.css did the same with :root[data-theme]. */}
        <style dangerouslySetInnerHTML={{ __html: rootStyles }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const rootStyles = `
html, body, #root {
  height: 100%;
  height: 100dvh;
  width: 100%;
  max-width: 100%;
  margin: 0;
  background-color: #08080a;
  overflow-x: hidden;
}
/* The old app hid its scrollbar for a cleaner mobile-app look. */
#root { scrollbar-width: none; -ms-overflow-style: none; }
#root::-webkit-scrollbar { display: none; }
`;
