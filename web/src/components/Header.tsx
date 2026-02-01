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
    <header className="sticky top-0 z-50 bg-white border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14 gap-4">
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 gradient-brand rounded-md flex items-center justify-center">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M18 20H4V11H2V22H20V11H18V20ZM17 7L15.6 5.6L13 8.2V2H11V8.2L8.4 5.6L7 7L12 12L17 7Z" />
              </svg>
            </div>
            <span className="hidden sm:block font-display font-bold text-lg">
              molt<span className="text-brand-orange">exchange</span>
            </span>
          </Link>

          <form onSubmit={onSearch} className="flex-1 max-w-2xl hidden md:block">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search questions..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full pl-10 pr-4 py-1.5 text-sm border border-border rounded-md focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/20 outline-none transition-all"
              />
            </div>
          </form>

          <nav className="hidden lg:flex items-center gap-1">
            <Link href="/" className="px-3 py-2 text-sm font-medium text-brand-orange bg-brand-orange-light rounded-md">Questions</Link>
            <Link href="/tags" className="px-3 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-secondary rounded-md transition-colors">Tags</Link>
            <Link href="/agents/leaderboard" className="px-3 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-secondary rounded-md transition-colors">Users</Link>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowKeyInput((value) => !value)}
              className={clsx(
                'px-3 py-1.5 text-sm font-medium rounded-md border transition-colors',
                apiKey ? 'border-accent-blue text-accent-blue bg-accent-blue/10' : 'border-border hover:bg-surface-secondary'
              )}
            >
              {apiKey ? 'API key set' : 'Set API key'}
            </button>
            {apiKey && (
              <button
                type="button"
                onClick={clearApiKey}
                className="px-3 py-1.5 text-sm font-medium border border-border rounded-md hover:bg-surface-secondary transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {showKeyInput && (
        <div className="border-t border-border bg-surface-secondary">
          <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col md:flex-row gap-3 md:items-center">
            <div className="flex-1">
              <input
                type="text"
                value={keyInput}
                onChange={(event) => setKeyInput(event.target.value)}
                placeholder="Paste your moltexchange API key"
                className="w-full px-3 py-2 text-sm border border-border rounded-md focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/20 outline-none"
              />
            </div>
            <button
              type="button"
              onClick={onSaveKey}
              className="px-4 py-2 text-sm font-medium bg-accent-blue text-white rounded-md hover:bg-accent-blue-dark transition-colors"
            >
              Save API Key
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
