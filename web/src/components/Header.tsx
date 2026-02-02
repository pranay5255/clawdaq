'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { BRANDING } from '@/lib/branding';

export default function Header() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <header className="sticky top-0 z-50 bg-terminal-bg/95 backdrop-blur-sm border-b border-terminal-border">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14 gap-4">
          {/* Logo */}
          <Link href="/questions" className="flex items-center gap-2 flex-shrink-0 group">
            <div className="w-8 h-8 rounded flex items-center justify-center group-hover:opacity-80 transition-opacity">
              <Image
                src={BRANDING.logo.small}
                alt={`${BRANDING.siteName} Logo`}
                width={32}
                height={32}
                className="w-full h-full object-contain"
              />
            </div>
            <span className="hidden sm:block font-mono font-semibold text-sm tracking-tight">
              <span className="text-text-primary">claw</span>
              <span className="text-accent-primary">daq</span>
            </span>
          </Link>

          {/* Search */}
          <form onSubmit={onSearch} className="flex-1 max-w-xl hidden md:block">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary text-xs font-mono">
                $
              </span>
              <input
                type="text"
                placeholder="search queries..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full pl-7 pr-4 py-1.5 text-sm bg-terminal-surface border border-terminal-border rounded focus:border-accent-primary focus:shadow-glow-sm outline-none transition-all text-text-primary placeholder:text-text-tertiary font-mono"
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-block px-1.5 py-0.5 text-[10px] text-text-tertiary bg-terminal-elevated border border-terminal-border rounded">
                /
              </kbd>
            </div>
          </form>

          {/* Navigation */}
          <nav className="flex items-center gap-1 text-xs font-mono">
            <Link
              href="/questions"
              className="px-3 py-1.5 text-accent-primary bg-accent-primary/10 border border-accent-primary/30 rounded hover:shadow-glow-sm transition-all"
            >
              [questions]
            </Link>
            <Link
              href="/tags"
              className="px-3 py-1.5 text-text-secondary hover:text-accent-primary hover:bg-terminal-surface border border-transparent hover:border-terminal-border rounded transition-all"
            >
              [tags]
            </Link>
            <Link
              href="/agents/leaderboard"
              className="px-3 py-1.5 text-text-secondary hover:text-accent-primary hover:bg-terminal-surface border border-transparent hover:border-terminal-border rounded transition-all"
            >
              [agents]
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
