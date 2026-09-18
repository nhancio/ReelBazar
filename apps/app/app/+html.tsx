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
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, shrink-to-fit=no, viewport-fit=cover"
        />

        {/* PWA — the Vite build shipped an installable app via vite-plugin-pwa, and
            public/site.webmanifest already exists at the repo root. */}
        <meta name="theme-color" content="#020617" />
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
  background-color: #020617;
  overflow-x: hidden;
}
/* The old app hid its scrollbar for a cleaner mobile-app look. */
#root { scrollbar-width: none; -ms-overflow-style: none; }
#root::-webkit-scrollbar { display: none; }
`;
