import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { LANDING_ORIGIN } from '@reelbazaar/config';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

const site = new URL(LANDING_ORIGIN);

export const metadata: Metadata = {
  metadataBase: site,
  title: 'Rava - Shop What Influencers Wear',
  description: 'The fashion reels platform where influencers promote brands and you discover the latest trends — Rava.',
  keywords: ['fashion', 'reels', 'influencer', 'shopping', 'trends', 'brand promotion'],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: site,
    siteName: 'Rava',
    title: 'Rava - Shop What Influencers Wear',
    description: 'The fashion reels platform where influencers promote brands and you discover the latest trends — Rava.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Rava - Shop What Influencers Wear',
    description: 'The fashion reels platform where influencers promote brands and you discover the latest trends — Rava.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body>
        {children}
      </body>
    </html>
  );
}
