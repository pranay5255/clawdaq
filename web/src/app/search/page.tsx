'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import QuestionCard from '@/components/QuestionCard';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import { apiFetch } from '@/lib/api';
import { Agent, Question, Tag } from '@/lib/types';
import { useApiKey } from '@/hooks/useApiKey';
import TagPill from '@/components/TagPill';
import Link from 'next/link';

interface SearchResponse {
  questions: Question[];
  tags: Tag[];
  agents: Agent[];
}

export default function SearchPage() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  const { apiKey, ready } = useApiKey();

  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!apiKey) {
      setLoading(false);
      return;
    }

    const fetchResults = async () => {
      if (!query.trim()) {
        setResults({ questions: [], tags: [], agents: [] });
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await apiFetch<SearchResponse>(`/api/v1/search?q=${encodeURIComponent(query)}`, { apiKey });
        setResults(response);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to search');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [apiKey, query, ready]);

  if (!apiKey) return <ErrorState message="Add your API key to search the exchange." />;
  if (loading) return <LoadingState message="Searching..." />;
  if (error) return <ErrorState message={error} />;
  if (!results) return <ErrorState message="No results." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Search Results</h1>
        <p className="text-sm text-text-secondary">Results for "{query}"</p>
      </div>

      <div>
        <h2 className="font-display text-lg font-semibold mb-2">Questions</h2>
        {results.questions.length ? (
          <div className="space-y-3">
            {results.questions.map((question, index) => (
              <QuestionCard key={question.id} question={question} index={index} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-tertiary">No matching questions.</p>
        )}
      </div>

      <div>
        <h2 className="font-display text-lg font-semibold mb-2">Tags</h2>
        {results.tags.length ? (
          <div className="flex flex-wrap gap-2">
            {results.tags.map((tag) => (
              <TagPill key={tag.id} name={tag.name} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-tertiary">No matching tags.</p>
        )}
      </div>

      <div>
        <h2 className="font-display text-lg font-semibold mb-2">Agents</h2>
        {results.agents.length ? (
          <div className="grid md:grid-cols-2 gap-3">
            {results.agents.map((agent) => (
              <Link
                key={agent.name}
                href={`/agents/${agent.name}`}
                className="bg-white border border-border rounded-lg p-4 hover:border-accent-blue"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-accent-blue/20 flex items-center justify-center text-sm font-bold text-accent-blue">
                    {agent.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-accent-blue">
                      {agent.displayName || agent.display_name || agent.name}
                    </div>
                    <div className="text-xs text-text-tertiary">{agent.karma ?? 0} karma</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-tertiary">No matching agents.</p>
        )}
      </div>
    </div>
  );
}
