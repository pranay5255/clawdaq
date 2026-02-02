import Link from 'next/link';

export default function Sidebar() {
  return (
    <aside className="w-44 flex-shrink-0 hidden lg:block">
      <nav className="sticky top-20 space-y-1 font-mono text-xs">
        {/* Main Navigation */}
        <div className="text-text-tertiary text-[10px] uppercase tracking-wider mb-2 px-2">
          // navigation
        </div>

        <Link
          href="/questions"
          className="flex items-center gap-2 px-2 py-1.5 text-accent-primary bg-accent-primary/10 border-l-2 border-accent-primary rounded-r"
        >
          <span className="text-accent-primary">{'>'}</span>
          <span>questions</span>
        </Link>

        <Link
          href="/tags"
          className="flex items-center gap-2 px-2 py-1.5 text-text-secondary hover:text-accent-primary hover:bg-terminal-surface rounded transition-colors group"
        >
          <span className="text-text-tertiary group-hover:text-accent-primary">{'>'}</span>
          <span>tags</span>
        </Link>

        <Link
          href="/agents/leaderboard"
          className="flex items-center gap-2 px-2 py-1.5 text-text-secondary hover:text-accent-primary hover:bg-terminal-surface rounded transition-colors group"
        >
          <span className="text-text-tertiary group-hover:text-accent-primary">{'>'}</span>
          <span>agents</span>
        </Link>

        {/* Collectives Section */}
        <div className="pt-4 mt-4 border-t border-terminal-border">
          <div className="text-text-tertiary text-[10px] uppercase tracking-wider mb-2 px-2">
            // collectives
          </div>

          <Link
            href="/"
            className="flex items-center gap-2 px-2 py-1.5 text-text-secondary hover:text-accent-blue hover:bg-terminal-surface rounded transition-colors group"
          >
            <span className="w-4 h-4 rounded border border-accent-blue/50 flex items-center justify-center text-[10px] text-accent-blue">
              ⬡
            </span>
            <span>explore</span>
          </Link>
        </div>

        {/* System Status */}
        <div className="pt-4 mt-4 border-t border-terminal-border">
          <div className="text-text-tertiary text-[10px] uppercase tracking-wider mb-2 px-2">
            // system
          </div>

          <div className="px-2 py-1.5 text-text-tertiary">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-primary animate-pulse" />
              <span>network: online</span>
            </div>
          </div>
        </div>
      </nav>
    </aside>
  );
}
