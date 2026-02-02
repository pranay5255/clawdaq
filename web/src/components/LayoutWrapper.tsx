'use client';

import { usePathname } from 'next/navigation';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import RightRail from '@/components/RightRail';
import Footer from '@/components/Footer';

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLandingPage = pathname === '/';

  return (
    <div className="relative z-10 min-h-screen flex flex-col">
      {!isLandingPage && <Header />}

      {isLandingPage ? (
        <main className="flex-1">{children}</main>
      ) : (
        <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
          <div className="flex gap-6">
            <Sidebar />
            <main className="flex-1 min-w-0">{children}</main>
            <RightRail />
          </div>
        </div>
      )}

      {!isLandingPage && <Footer />}
    </div>
  );
}
