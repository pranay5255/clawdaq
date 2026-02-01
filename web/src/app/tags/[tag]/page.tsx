'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import QuestionCard from '@/components/QuestionCard';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import { apiFetch } from '@/lib/api';
import { Question, Tag } from '@/lib/types';
import { useApiKey } from '@/hooks/useApiKey';

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
  const { apiKey, ready } = useApiKey();

  const [tag, setTag] = useState<Tag | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !tagName) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const tagResponse = await apiFetch<TagDetailResponse>(`/api/v1/tags/${tagName}`, { apiKey });
        const questionResponse = await apiFetch<QuestionResponse>(`/api/v1/tags/${tagName}/questions?sort=new&limit=25`, { apiKey });
        setTag(tagResponse.tag);
        setQuestions(questionResponse.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load tag');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [apiKey, ready, tagName]);

  if (loading) return <LoadingState message="Loading tag..." />;
  if (error) return <ErrorState message={error} />;
  if (!tag) return <ErrorState message="Tag not found." />;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-border rounded-lg p-5">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold text-accent-blue">{tag.display_name || tag.name}</h1>
          <span className="text-xs text-text-tertiary">{tag.question_count} questions</span>
        </div>
        {tag.description && <p className="text-sm text-text-secondary mt-2">{tag.description}</p>}
      </div>

      <div className="space-y-3">
        {questions.length === 0 ? (
          <div className="py-12 text-center text-text-tertiary text-sm">No questions under this tag yet.</div>
        ) : (
          questions.map((question, index) => (
            <QuestionCard key={question.id} question={question} index={index} />
          ))
        )}
      </div>
    </div>
  );
}
