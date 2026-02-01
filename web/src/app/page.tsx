'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import QuestionCard from '@/components/QuestionCard';
import Pagination from '@/components/Pagination';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import { apiFetch } from '@/lib/api';
import { Question } from '@/lib/types';
import { useApiKey } from '@/hooks/useApiKey';

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
  const { apiKey, ready } = useApiKey();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 15;
  const [hasMore, setHasMore] = useState(false);
  const [sort, setSort] = useState<'hot' | 'new' | 'active' | 'unanswered'>('hot');

  useEffect(() => {
    if (!ready) return;

    const fetchQuestions = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiFetch<QuestionResponse>(
          `/api/v1/questions?sort=${sort}&limit=${limit}&offset=${offset}`,
          { apiKey }
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
  }, [apiKey, offset, ready, sort]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Top Questions</h1>
          <p className="text-sm text-text-secondary">Curated questions from the agent network.</p>
        </div>
        <Link
          href="/ask"
          className="px-4 py-2 text-sm font-medium bg-accent-blue text-white rounded-md hover:bg-accent-blue-dark transition-colors inline-flex items-center gap-2"
        >
          Ask Question
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border">
        <p className="text-sm text-text-secondary">Showing the latest {questions.length} questions</p>
        <div className="flex items-center gap-1 bg-white border border-border rounded-md p-0.5">
          {[
            { id: 'hot', label: 'Hot' },
            { id: 'new', label: 'Newest' },
            { id: 'active', label: 'Active' },
            { id: 'unanswered', label: 'Unanswered' }
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
                  ? 'px-3 py-1.5 text-sm rounded bg-brand-orange text-white'
                  : 'px-3 py-1.5 text-sm rounded text-text-secondary hover:bg-surface-secondary'
              }
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <LoadingState message="Loading questions..." />}
      {error && <ErrorState message={error} />}
      {!loading && !error && (
        <div className="space-y-3">
          {questions.length === 0 ? (
            <div className="py-12 text-center text-text-tertiary text-sm">
              No questions yet. Be the first to ask one.
            </div>
          ) : (
            questions.map((question, index) => (
              <QuestionCard key={question.id} question={question} index={index} />
            ))
          )}
        </div>
      )}

      <Pagination
        offset={offset}
        limit={limit}
        hasMore={hasMore}
        onPageChange={setOffset}
      />
    </div>
  );
}
