'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { apiFetch } from '@/lib/api';
import { useApiKey } from '@/hooks/useApiKey';

interface VoteWidgetProps {
  score: number;
  targetId: string;
  targetType: 'question' | 'answer';
  userVote?: number | null;
  compact?: boolean;
}

export default function VoteWidget({
  score,
  targetId,
  targetType,
  userVote = null,
  compact = false,
}: VoteWidgetProps) {
  const { apiKey } = useApiKey();
  const [currentScore, setCurrentScore] = useState(score);
  const [currentVote, setCurrentVote] = useState<number | null>(userVote);
  const [loading, setLoading] = useState(false);
  const disabled = !apiKey || loading;

  const vote = async (direction: 'up' | 'down') => {
    if (!apiKey) return;
    if (loading) return;

    setLoading(true);
    const endpoint =
      targetType === 'question'
        ? `/api/v1/questions/${targetId}`
        : `/api/v1/answers/${targetId}`;

    try {
      await apiFetch(`${endpoint}/${direction}vote`, { apiKey, method: 'POST' });

      let nextVote: number | null = direction === 'up' ? 1 : -1;
      if (currentVote === nextVote) {
        nextVote = null;
      }

      const scoreDelta = (nextVote ?? 0) - (currentVote ?? 0);
      setCurrentVote(nextVote);
      setCurrentScore((prev) => prev + scoreDelta);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={clsx('flex flex-col items-center font-mono', compact ? 'gap-1' : 'gap-2')}>
      <button
        type="button"
        onClick={() => vote('up')}
        disabled={disabled}
        className={clsx(
          'vote-btn w-8 h-8 flex items-center justify-center rounded border transition-all',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          currentVote === 1
            ? 'border-accent-primary text-accent-primary bg-accent-primary/10 shadow-glow-sm'
            : 'border-terminal-border text-text-tertiary hover:border-accent-primary hover:text-accent-primary'
        )}
        aria-label="Upvote"
      >
        ▲
      </button>

      <span
        className={clsx(
          'font-semibold tabular-nums',
          compact ? 'text-sm' : 'text-base',
          currentScore > 0 && 'text-accent-primary',
          currentScore < 0 && 'text-accent-red',
          currentScore === 0 && 'text-text-secondary'
        )}
      >
        {currentScore}
      </span>

      <button
        type="button"
        onClick={() => vote('down')}
        disabled={disabled}
        className={clsx(
          'vote-btn w-8 h-8 flex items-center justify-center rounded border transition-all',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          currentVote === -1
            ? 'border-accent-red text-accent-red bg-accent-red/10'
            : 'border-terminal-border text-text-tertiary hover:border-accent-red hover:text-accent-red'
        )}
        aria-label="Downvote"
      >
        ▼
      </button>
    </div>
  );
}
