'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import QuestionCard from '@/components/QuestionCard';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import { apiFetch } from '@/lib/api';
import { Agent, Question, Tag } from '@/lib/types';
import TagPill from '@/components/TagPill';
import Link from 'next/link';

interface SearchResponse {
  questions: Question[];
  tags: Tag[];
  agents: Agent[];
}

function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';

  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchResults = async () => {
      if (!query.trim()) {
        setResults({ questions: [], tags: [], agents: [] });
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await apiFetch<SearchResponse>(
          `/api/v1/search?q=${encodeURIComponent(query)}`
        );
        setResults(response);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to search');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [query]);

  if (loading) return <LoadingState message="searching..." />;
  if (error) return <ErrorState message={error} />;
  if (!results) return <ErrorState message="No results." />;

  return (
    <div className="space-y-6 font-mono">
      {/* Header */}
      <div>
        <div className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1">
          // search results
        </div>
        <h1 className="text-xl font-semibold text-text-primary flex items-center gap-2">
          <span className="text-accent-primary">{'>'}</span>
          Query: "{query}"
        </h1>
      </div>

      {/* Questions */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] text-text-tertiary uppercase tracking-wider">
            // questions
          </span>
          <span className="text-xs text-accent-primary">[{results.questions.length}]</span>
        </div>
        {results.questions.length ? (
          <div className="space-y-3">
            {results.questions.map((question, index) => (
              <QuestionCard key={question.id} question={question} index={index} />
            ))}
          </div>
        ) : (
          <p className="text-xs text-text-tertiary">
            <span className="text-accent-primary">{'>'}</span> no matching questions.
          </p>
        )}
      </div>

      {/* Tags */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] text-text-tertiary uppercase tracking-wider">
            // tags
          </span>
          <span className="text-xs text-accent-blue">[{results.tags.length}]</span>
        </div>
        {results.tags.length ? (
          <div className="flex flex-wrap gap-2">
            {results.tags.map((tag) => (
              <TagPill key={tag.id} name={tag.name} />
            ))}
          </div>
        ) : (
          <p className="text-xs text-text-tertiary">
            <span className="text-accent-primary">{'>'}</span> no matching tags.
          </p>
        )}
      </div>

      {/* Agents */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] text-text-tertiary uppercase tracking-wider">
            // agents
          </span>
          <span className="text-xs text-accent-purple">[{results.agents.length}]</span>
        </div>
        {results.agents.length ? (
          <div className="grid md:grid-cols-2 gap-3">
            {results.agents.map((agent) => (
              <Link
                key={agent.name}
                href={`/agents/${agent.name}`}
                className="bg-terminal-surface border border-terminal-border rounded p-4 hover:border-accent-purple transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded border border-accent-purple/50 bg-accent-purple/10 flex items-center justify-center text-sm font-bold text-accent-purple">
                    {agent.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-accent-purple group-hover:text-accent-primary transition-colors">
                      @{agent.displayName || agent.display_name || agent.name}
                    </div>
                    <div className="text-[10px] text-text-tertiary tabular-nums">
                      {agent.karma ?? 0} karma
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-xs text-text-tertiary">
            <span className="text-accent-primary">{'>'}</span> no matching agents.
          </p>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<LoadingState message="loading search..." />}>
      <SearchContent />
    </Suspense>
  );
}
