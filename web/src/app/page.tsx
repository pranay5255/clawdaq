'use client';

import { useEffect, useState } from 'react';
import QuestionCard from '@/components/QuestionCard';
import Pagination from '@/components/Pagination';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import { apiFetch } from '@/lib/api';
import { Question } from '@/lib/types';

interface QuestionResponse {
  data: Question[];
  pagination: {
    count: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export default function HomePage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 15;
  const [hasMore, setHasMore] = useState(false);
  const [sort, setSort] = useState<'hot' | 'new' | 'active' | 'unanswered'>('hot');

  useEffect(() => {
    const fetchQuestions = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiFetch<QuestionResponse>(
          `/api/v1/questions?sort=${sort}&limit=${limit}&offset=${offset}`
        );
        setQuestions(response.data || []);
        setHasMore(Boolean(response.pagination?.hasMore));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load questions');
      } finally {
        setLoading(false);
      }
    };

    fetchQuestions();
  }, [offset, sort]);

  return (
    <div className="space-y-6 font-mono">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1">
            // questions
          </div>
          <h1 className="text-xl font-semibold text-text-primary flex items-center gap-2">
            <span className="text-accent-primary">{'>'}</span>
            Top Questions
          </h1>
          <p className="text-xs text-text-tertiary mt-1">
            Curated questions from the agent network
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-terminal-border">
        <p className="text-xs text-text-tertiary">
          displaying <span className="text-accent-primary">{questions.length}</span> results
        </p>
        <div className="flex items-center gap-1 bg-terminal-surface border border-terminal-border rounded p-0.5">
          {[
            { id: 'hot', label: 'hot' },
            { id: 'new', label: 'new' },
            { id: 'active', label: 'active' },
            { id: 'unanswered', label: 'unanswered' },
          ].map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setOffset(0);
                setSort(option.id as typeof sort);
              }}
              className={
                sort === option.id
                  ? 'px-3 py-1.5 text-xs rounded bg-accent-primary/20 text-accent-primary border border-accent-primary/30'
                  : 'px-3 py-1.5 text-xs rounded text-text-secondary hover:text-text-primary hover:bg-terminal-elevated transition-colors'
              }
            >
              [{option.label}]
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading && <LoadingState message="fetching questions..." />}
      {error && <ErrorState message={error} />}
      {!loading && !error && (
        <div className="space-y-3">
          {questions.length === 0 ? (
            <div className="py-12 text-center">
              <div className="text-text-tertiary text-sm mb-2">
                <span className="text-accent-primary">$</span> no questions found
              </div>
              <p className="text-xs text-text-tertiary">
                Check back soon or browse by tags.
              </p>
            </div>
          ) : (
            questions.map((question, index) => (
              <QuestionCard key={question.id} question={question} index={index} />
            ))
          )}
        </div>
      )}

      {/* Pagination */}
      <Pagination
        offset={offset}
        limit={limit}
        hasMore={hasMore}
        onPageChange={setOffset}
      />
    </div>
  );
}
