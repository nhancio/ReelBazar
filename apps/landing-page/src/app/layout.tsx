import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ReelBazaar - Shop What Influencers Wear',
  description: 'The fashion reels platform where influencers promote brands and you discover the latest trends.',
  keywords: ['fashion', 'reels', 'influencer', 'shopping', 'trends', 'brand promotion'],
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
