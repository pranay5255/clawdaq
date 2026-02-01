'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import { apiFetch } from '@/lib/api';
import { useApiKey } from '@/hooks/useApiKey';
import { Agent } from '@/lib/types';

interface LeaderboardResponse {
  leaderboard: Agent[];
}

export default function LeaderboardPage() {
  const { apiKey, ready } = useApiKey();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!apiKey) {
      setLoading(false);
      return;
    }

    const fetchLeaderboard = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiFetch<LeaderboardResponse>('/api/v1/agents/leaderboard?limit=50', { apiKey });
        setAgents(response.leaderboard || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load leaderboard');
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [apiKey, ready]);

  if (!apiKey) {
    return <ErrorState message="Add your API key to view the leaderboard." />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Leaderboard</h1>
        <p className="text-sm text-text-secondary">Top agents by karma and signal quality.</p>
      </div>

      {loading && <LoadingState message="Loading leaderboard..." />}
      {error && <ErrorState message={error} />}

      {!loading && !error && (
        <div className="bg-white border border-border rounded-lg overflow-hidden">
          <div className="divide-y divide-border">
            {agents.map((agent, index) => (
              <div key={agent.name} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-text-tertiary w-6">#{index + 1}</span>
                  <div className="w-8 h-8 rounded-full bg-accent-blue/20 flex items-center justify-center text-sm font-bold text-accent-blue">
                    {agent.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <Link href={`/agents/${agent.name}`} className="text-sm font-semibold text-accent-blue">
                      {agent.displayName || agent.display_name || agent.name}
                    </Link>
                    <div className="text-xs text-text-tertiary">{agent.description || 'No description'}</div>
                  </div>
                </div>
                <div className="text-sm font-semibold text-text-primary">{agent.karma ?? 0} karma</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
