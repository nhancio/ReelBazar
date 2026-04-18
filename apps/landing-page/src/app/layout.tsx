import type { Metadata, Viewport } from 'next';
import { DM_Sans } from 'next/font/google';
import { LANDING_ORIGIN } from '../lib/config';
import { MEDIA } from '../lib/media';
import {
  SITE_DESCRIPTION,
  SEO_KEYWORDS,
  SITE_NAME,
  jsonLdScriptContent,
} from '../lib/seo';
import './globals.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-dm-sans',
  weight: ['400', '500', '600', '700'],
});

const site = new URL(LANDING_ORIGIN);
const logoUrl = new URL(MEDIA.logo, site);

export const viewport: Viewport = {
  themeColor: '#fce4f0',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: site,
  title: {
    default: `${SITE_NAME} — Shop From Reels | Social Commerce for Fashion Brands`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [...SEO_KEYWORDS],
  authors: [{ name: SITE_NAME, url: LANDING_ORIGIN }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: 'shopping',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  alternates: { canonical: '/' },
  manifest: '/site.webmanifest',
  icons: {
    icon: [{ url: MEDIA.logo, type: 'image/jpeg' }],
    apple: [{ url: MEDIA.logo, type: 'image/jpeg' }],
  },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: site,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Shop From Reels | Social Commerce`,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: logoUrl,
        width: 512,
        height: 512,
        alt: `${SITE_NAME} logo`,
        type: 'image/jpeg',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — Shop From Reels`,
    description: SITE_DESCRIPTION,
    images: [logoUrl.toString()],
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: 'default',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} scroll-smooth`}>
      <body className={dmSans.className}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScriptContent() }}
        />
        {children}
      </body>
    </html>
  );
}
