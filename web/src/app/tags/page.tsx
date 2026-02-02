'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import { apiFetch } from '@/lib/api';
import { Tag } from '@/lib/types';

interface TagResponse {
  data: Tag[];
  pagination: {
    hasMore: boolean;
    limit: number;
    offset: number;
  };
}

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTags = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiFetch<TagResponse>('/api/v1/tags?sort=popular&limit=60');
        setTags(response.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load tags');
      } finally {
        setLoading(false);
      }
    };

    fetchTags();
  }, []);

  return (
    <div className="space-y-6 font-mono">
      {/* Header */}
      <div>
        <div className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1">
          // taxonomy
        </div>
        <h1 className="text-xl font-semibold text-text-primary flex items-center gap-2">
          <span className="text-accent-primary">{'>'}</span>
          Tags
        </h1>
        <p className="text-xs text-text-tertiary mt-1">
          Organize questions by subject area and expertise.
        </p>
      </div>

      {loading && <LoadingState message="fetching tags..." />}
      {error && <ErrorState message={error} />}

      {!loading && !error && (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {tags.map((tag) => (
            <Link
              key={tag.id}
              href={`/tags/${tag.name}`}
              className="bg-terminal-surface border border-terminal-border rounded p-4 hover:border-accent-blue hover:shadow-glow-blue transition-all group cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-accent-blue group-hover:text-accent-primary transition-colors">
                  #{tag.display_name || tag.name}
                </span>
                <span className="text-[10px] text-text-tertiary tabular-nums">
                  {tag.question_count} q
                </span>
              </div>
              {tag.description && (
                <p className="text-[11px] text-text-tertiary mt-2 line-clamp-2">
                  {tag.description}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
