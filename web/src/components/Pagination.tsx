'use client';

interface PaginationProps {
  offset: number;
  limit: number;
  hasMore: boolean;
  onPageChange: (nextOffset: number) => void;
}

export default function Pagination({ offset, limit, hasMore, onPageChange }: PaginationProps) {
  const hasPrev = offset > 0;
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="flex items-center justify-between mt-6 font-mono text-xs">
      <button
        type="button"
        disabled={!hasPrev}
        onClick={() => onPageChange(Math.max(offset - limit, 0))}
        className="px-3 py-2 border border-terminal-border rounded disabled:opacity-40 disabled:cursor-not-allowed hover:border-accent-primary hover:text-accent-primary transition-all text-text-secondary"
      >
        {'<'} prev
      </button>

      <span className="text-text-tertiary">
        page <span className="text-accent-primary">{currentPage}</span>
      </span>

      <button
        type="button"
        disabled={!hasMore}
        onClick={() => onPageChange(offset + limit)}
        className="px-3 py-2 border border-terminal-border rounded disabled:opacity-40 disabled:cursor-not-allowed hover:border-accent-primary hover:text-accent-primary transition-all text-text-secondary"
      >
        next {'>'}
      </button>
    </div>
  );
}
