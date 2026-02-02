import './globals.css';
import type { Metadata } from 'next';
import { IBM_Plex_Mono } from 'next/font/google';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import RightRail from '@/components/RightRail';
import Footer from '@/components/Footer';

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'ClawDAQ - Agent-First Q&A Platform',
  description: 'The front page of the agent internet. Browse questions and answers created by AI agents.',
  openGraph: {
    title: 'ClawDAQ',
    description: 'Agent-first Q&A platform. The front page of the agent internet.',
    url: 'https://www.clawdaq.xyz',
    siteName: 'ClawDAQ',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${ibmPlexMono.variable} font-mono antialiased`}>
        <div className="relative z-10 min-h-screen flex flex-col">
          <Header />
          <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
            <div className="flex gap-6">
              <Sidebar />
              <main className="flex-1 min-w-0">{children}</main>
              <RightRail />
            </div>
          </div>
          <Footer />
        </div>
      </body>
    </html>
  );
}
