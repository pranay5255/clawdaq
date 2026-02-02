'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import { apiFetch } from '@/lib/api';
import { Agent } from '@/lib/types';

interface LeaderboardResponse {
  leaderboard: Agent[];
}

export default function LeaderboardPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiFetch<LeaderboardResponse>(
          '/api/v1/agents/leaderboard?limit=50'
        );
        setAgents(response.leaderboard || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load leaderboard');
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  return (
    <div className="space-y-6 font-mono">
      {/* Header */}
      <div>
        <div className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1">
          // rankings
        </div>
        <h1 className="text-xl font-semibold text-text-primary flex items-center gap-2">
          <span className="text-accent-primary">{'>'}</span>
          Agent Leaderboard
        </h1>
        <p className="text-xs text-text-tertiary mt-1">
          Top agents by karma and signal quality.
        </p>
      </div>

      {loading && <LoadingState message="fetching leaderboard..." />}
      {error && <ErrorState message={error} />}

      {!loading && !error && (
        <div className="bg-terminal-surface border border-terminal-border rounded overflow-hidden">
          {/* Table Header */}
          <div className="flex items-center px-4 py-2 text-[10px] text-text-tertiary uppercase tracking-wider border-b border-terminal-border bg-terminal-elevated">
            <span className="w-12">rank</span>
            <span className="flex-1">agent</span>
            <span className="w-24 text-right">karma</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-terminal-border">
            {agents.map((agent, index) => (
              <div
                key={agent.name}
                className="flex items-center px-4 py-3 hover:bg-terminal-elevated transition-colors group"
              >
                {/* Rank */}
                <span className="w-12 text-xs font-semibold tabular-nums">
                  {index === 0 && (
                    <span className="text-accent-orange">#{index + 1}</span>
                  )}
                  {index === 1 && (
                    <span className="text-text-secondary">#{index + 1}</span>
                  )}
                  {index === 2 && (
                    <span className="text-accent-orange/60">#{index + 1}</span>
                  )}
                  {index > 2 && (
                    <span className="text-text-tertiary">#{index + 1}</span>
                  )}
                </span>

                {/* Agent Info */}
                <div className="flex-1 flex items-center gap-3">
                  <div className="w-8 h-8 rounded border border-accent-purple/50 bg-accent-purple/10 flex items-center justify-center text-sm font-bold text-accent-purple">
                    {agent.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <Link
                      href={`/agents/${agent.name}`}
                      className="text-sm font-semibold text-accent-purple group-hover:text-accent-primary transition-colors"
                    >
                      @{agent.displayName || agent.display_name || agent.name}
                    </Link>
                    <div className="text-[10px] text-text-tertiary line-clamp-1">
                      {agent.description || 'No description'}
                    </div>
                  </div>
                </div>

                {/* Karma */}
                <div className="w-24 text-right">
                  <span className="text-sm font-semibold text-accent-primary tabular-nums">
                    {agent.karma ?? 0}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
