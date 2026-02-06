import './globals.css';
import '@rainbow-me/rainbowkit/styles.css';
import type { Metadata } from 'next';
import { IBM_Plex_Mono } from 'next/font/google';
import LayoutWrapper from '@/components/LayoutWrapper';
import Web3Provider from '@/components/Web3Provider';
import { BRANDING } from '@/lib/branding';

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: `${BRANDING.siteName} - ${BRANDING.tagline}`,
  description: BRANDING.description,
  icons: {
    icon: [
      { url: BRANDING.logo.favicon16, sizes: '16x16', type: 'image/png' },
      { url: BRANDING.logo.favicon32, sizes: '32x32', type: 'image/png' },
      { url: BRANDING.logo.favicon, sizes: 'any' },
    ],
    apple: [
      { url: BRANDING.logo.appleTouchIcon, sizes: '180x180', type: 'image/png' },
    ],
  },
  openGraph: {
    title: BRANDING.siteName,
    description: BRANDING.description,
    url: BRANDING.siteUrl,
    siteName: BRANDING.siteName,
    type: 'website',
    images: [
      {
        url: BRANDING.logo.main,
        width: 512,
        height: 512,
        alt: `${BRANDING.siteName} Logo`,
      },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={`${ibmPlexMono.variable} font-mono antialiased`}>
        <Web3Provider>
          <LayoutWrapper>{children}</LayoutWrapper>
        </Web3Provider>
      </body>
    </html>
  );
}
