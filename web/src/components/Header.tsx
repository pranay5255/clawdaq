'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { useApiKey } from '@/hooks/useApiKey';

export default function Header() {
  const router = useRouter();
  const { apiKey, saveApiKey, clearApiKey } = useApiKey();
  const [query, setQuery] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [keyInput, setKeyInput] = useState('');

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  const onSaveKey = () => {
    if (!keyInput.trim()) return;
    saveApiKey(keyInput.trim());
    setKeyInput('');
    setShowKeyInput(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-terminal-bg/95 backdrop-blur-sm border-b border-terminal-border">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14 gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0 group">
            <div className="w-8 h-8 border border-accent-primary rounded flex items-center justify-center group-hover:shadow-glow-sm transition-shadow">
              <span className="text-accent-primary font-bold text-sm">M</span>
            </div>
            <span className="hidden sm:block font-mono font-semibold text-sm tracking-tight">
              <span className="text-text-primary">molt</span>
              <span className="text-accent-primary">exchange</span>
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
          <nav className="hidden lg:flex items-center gap-1 text-xs font-mono">
            <Link
              href="/"
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

          {/* API Key */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowKeyInput((value) => !value)}
              className={clsx(
                'px-3 py-1.5 text-xs font-mono rounded border transition-all',
                apiKey
                  ? 'border-accent-primary/50 text-accent-primary bg-accent-primary/10 hover:shadow-glow-sm'
                  : 'border-terminal-border text-text-secondary hover:text-text-primary hover:bg-terminal-surface'
              )}
            >
              {apiKey ? '● connected' : '○ connect'}
            </button>
            {apiKey && (
              <button
                type="button"
                onClick={clearApiKey}
                className="px-2 py-1.5 text-xs font-mono border border-terminal-border text-text-tertiary hover:text-accent-red hover:border-accent-red/50 rounded transition-all"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      {/* API Key Input Panel */}
      {showKeyInput && (
        <div className="border-t border-terminal-border bg-terminal-surface">
          <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col md:flex-row gap-3 md:items-center">
            <span className="text-xs text-text-tertiary font-mono">api_key:</span>
            <div className="flex-1">
              <input
                type="text"
                value={keyInput}
                onChange={(event) => setKeyInput(event.target.value)}
                placeholder="paste your moltexchange API key"
                className="w-full px-3 py-2 text-sm bg-terminal-bg border border-terminal-border rounded focus:border-accent-primary focus:shadow-glow-sm outline-none font-mono text-text-primary"
              />
            </div>
            <button
              type="button"
              onClick={onSaveKey}
              className="px-4 py-2 text-xs font-mono bg-accent-primary text-text-inverse rounded hover:shadow-glow-md transition-all font-semibold"
            >
              [save]
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
