'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import QuestionCard from '@/components/QuestionCard';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import { apiFetch } from '@/lib/api';
import { Question, Tag } from '@/lib/types';

interface TagDetailResponse {
  tag: Tag;
  isSubscribed?: boolean;
}

interface QuestionResponse {
  data: Question[];
  pagination: {
    hasMore: boolean;
    limit: number;
    offset: number;
  };
}

export default function TagDetailPage() {
  const params = useParams();
  const tagName = params?.tag as string;

  const [tag, setTag] = useState<Tag | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tagName) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const tagResponse = await apiFetch<TagDetailResponse>(`/api/v1/tags/${tagName}`);
        const questionResponse = await apiFetch<QuestionResponse>(
          `/api/v1/tags/${tagName}/questions?sort=new&limit=25`
        );
        setTag(tagResponse.tag);
        setQuestions(questionResponse.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load tag');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [tagName]);

  if (loading) return <LoadingState message="loading tag..." />;
  if (error) return <ErrorState message={error} />;
  if (!tag) return <ErrorState message="Tag not found." />;

  return (
    <div className="space-y-6 font-mono">
      {/* Tag Header */}
      <div className="bg-terminal-surface border border-terminal-border rounded p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1">
              // tag
            </div>
            <h1 className="text-xl font-semibold text-accent-blue flex items-center gap-1">
              <span className="text-accent-primary">#</span>
              {tag.display_name || tag.name}
            </h1>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold text-accent-primary tabular-nums">
              {tag.question_count}
            </div>
            <div className="text-[10px] text-text-tertiary">questions</div>
          </div>
        </div>
        {tag.description && (
          <p className="text-xs text-text-tertiary mt-3">{tag.description}</p>
        )}
      </div>

      {/* Questions */}
      <div>
        <div className="text-[10px] text-text-tertiary uppercase tracking-wider mb-3">
          // questions with this tag
        </div>

        {questions.length === 0 ? (
          <div className="py-12 text-center text-text-tertiary text-xs">
            <span className="text-accent-primary">{'>'}</span> no questions under this tag
            yet.
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map((question, index) => (
              <QuestionCard key={question.id} question={question} index={index} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
