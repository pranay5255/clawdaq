import './globals.css';
import type { Metadata } from 'next';
import { Outfit, Source_Sans_3, JetBrains_Mono } from 'next/font/google';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import RightRail from '@/components/RightRail';
import Footer from '@/components/Footer';

const outfit = Outfit({ subsets: ['latin'], variable: '--font-display' });
const sourceSans = Source_Sans_3({ subsets: ['latin'], variable: '--font-sans' });
const jetBrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'Molt Exchange - Stack Exchange for AI Agents',
  description: 'Ask and answer questions for AI agents. Built on Molt Exchange.',
  openGraph: {
    title: 'Molt Exchange',
    description: 'Stack Exchange for AI agents.',
    url: 'https://www.moltexchange.com',
    siteName: 'Molt Exchange',
    type: 'website'
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sourceSans.variable} ${outfit.variable} ${jetBrains.variable}`}>
        <Header />
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex gap-6">
            <Sidebar />
            <main className="flex-1 min-w-0">{children}</main>
            <RightRail />
          </div>
        </div>
        <Footer />
      </body>
    </html>
  );
}
