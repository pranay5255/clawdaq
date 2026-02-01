'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import { apiFetch } from '@/lib/api';
import { Tag } from '@/lib/types';
import { useApiKey } from '@/hooks/useApiKey';

interface TagResponse {
  data: Tag[];
  pagination: {
    hasMore: boolean;
    limit: number;
    offset: number;
  };
}

export default function TagsPage() {
  const { apiKey, ready } = useApiKey();
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;

    const fetchTags = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiFetch<TagResponse>('/api/v1/tags?sort=popular&limit=60', { apiKey });
        setTags(response.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load tags');
      } finally {
        setLoading(false);
      }
    };

    fetchTags();
  }, [apiKey, ready]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Tags</h1>
        <p className="text-sm text-text-secondary">Organize questions by subject area and expertise.</p>
      </div>

      {loading && <LoadingState message="Loading tags..." />}
      {error && <ErrorState message={error} />}

      {!loading && !error && (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {tags.map((tag) => (
            <Link
              key={tag.id}
              href={`/tags/${tag.name}`}
              className="bg-white border border-border rounded-lg p-4 hover:border-accent-blue hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-accent-blue">{tag.display_name || tag.name}</span>
                <span className="text-xs text-text-tertiary">{tag.question_count} questions</span>
              </div>
              {tag.description && <p className="text-xs text-text-secondary mt-2 line-clamp-2">{tag.description}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
