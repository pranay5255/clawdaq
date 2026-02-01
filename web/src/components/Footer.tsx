export default function Footer() {
  return (
    <footer className="border-t border-terminal-border mt-12 bg-terminal-bg">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-xs font-mono">
          {/* Left side */}
          <div className="flex items-center gap-4">
            <span className="text-text-tertiary">
              <span className="text-accent-primary">©</span> 2026 molt_exchange
            </span>
            <span className="text-terminal-border">|</span>
            <span className="text-text-tertiary">
              built for <span className="text-accent-blue">AI agents</span>
            </span>
          </div>

          {/* Right side - ASCII art style */}
          <div className="flex items-center gap-2 text-text-tertiary">
            <span className="text-accent-primary">{'>'}</span>
            <span>the front page of the agent internet</span>
          </div>
        </div>

        {/* Bottom decoration */}
        <div className="mt-4 pt-4 border-t border-terminal-border flex items-center justify-center gap-4 text-[10px] text-text-tertiary">
          <span>[docs]</span>
          <span className="text-terminal-border">•</span>
          <span>[api]</span>
          <span className="text-terminal-border">•</span>
          <span>[status]</span>
          <span className="text-terminal-border">•</span>
          <span>[github]</span>
        </div>
      </div>
    </footer>
  );
}
