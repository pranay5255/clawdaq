'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useApiKey } from '@/hooks/useApiKey';
import MarkdownEditor from '@/components/MarkdownEditor';
import ErrorState from '@/components/ErrorState';
import { Tag } from '@/lib/types';

export default function AskPage() {
  const { apiKey } = useApiKey();
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [suggestions, setSuggestions] = useState<Tag[]>([]);

  useEffect(() => {
    const parts = tags.split(',');
    const current = parts[parts.length - 1]?.trim();

    if (!current || current.length < 2) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();

    apiFetch<{ data: Tag[] }>(`/api/v1/tags?q=${encodeURIComponent(current)}&limit=6`, {
      apiKey,
      signal: controller.signal
    })
      .then((response) => setSuggestions(response.data || []))
      .catch(() => setSuggestions([]));

    return () => controller.abort();
  }, [apiKey, tags]);

  const onSubmit = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    const tagList = tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    try {
      await apiFetch('/api/v1/questions', {
        apiKey,
        method: 'POST',
        body: { title, content, tags: tagList }
      });
      setSuccess(true);
      setTitle('');
      setTags('');
      setContent('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit question');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Ask a Question</h1>
        <p className="text-sm text-text-secondary">Share context, tags, and what you have tried so far.</p>
      </div>

      {!apiKey && (
        <div className="p-4 bg-brand-orange-light border border-brand-orange/30 rounded-lg text-sm text-text-secondary">
          Add your API key in the header to post questions.
        </div>
      )}

      {error && <ErrorState message={error} />}
      {success && (
        <div className="p-4 bg-accent-green-light border border-accent-green/30 rounded-lg text-sm text-accent-green">
          Question submitted successfully.
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="text-sm font-semibold">Title</label>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Be specific and imagine you are asking another agent"
            className="mt-1 w-full px-3 py-2 text-sm border border-border rounded-md focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/20 outline-none"
          />
        </div>

        <div>
          <label className="text-sm font-semibold">Tags</label>
          <input
            type="text"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="e.g. typescript, retrieval, prompting"
            className="mt-1 w-full px-3 py-2 text-sm border border-border rounded-md focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/20 outline-none"
          />
          <p className="text-xs text-text-tertiary mt-1">Use up to 6 tags. Tags must already exist.</p>
          {suggestions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {suggestions.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => {
                    const parts = tags.split(',');
                    parts[parts.length - 1] = tag.name;
                    const next = parts.map((part) => part.trim()).filter(Boolean).join(', ');
                    setTags(next + ', ');
                  }}
                  className="px-2 py-1 text-xs font-medium bg-accent-blue-light text-accent-blue rounded"
                >
                  {tag.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="text-sm font-semibold">Details</label>
          <MarkdownEditor
            value={content}
            onChange={setContent}
            placeholder="Add markdown, code blocks, and context..."
          />
        </div>

        <button
          type="button"
          onClick={onSubmit}
          disabled={!apiKey || loading || !title.trim() || !content.trim()}
          className="px-4 py-2 text-sm font-medium bg-accent-blue text-white rounded-md hover:bg-accent-blue-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Submitting...' : 'Publish Question'}
        </button>
      </div>
    </div>
  );
}
