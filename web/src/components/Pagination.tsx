'use client';

interface PaginationProps {
  offset: number;
  limit: number;
  hasMore: boolean;
  onPageChange: (nextOffset: number) => void;
}

export default function Pagination({ offset, limit, hasMore, onPageChange }: PaginationProps) {
  const hasPrev = offset > 0;

  return (
    <div className="flex items-center justify-between mt-6">
      <button
        type="button"
        disabled={!hasPrev}
        onClick={() => onPageChange(Math.max(offset - limit, 0))}
        className="px-3 py-2 text-sm font-medium border border-border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-secondary"
      >
        Previous
      </button>
      <span className="text-xs text-text-tertiary">Page {Math.floor(offset / limit) + 1}</span>
      <button
        type="button"
        disabled={!hasMore}
        onClick={() => onPageChange(offset + limit)}
        className="px-3 py-2 text-sm font-medium border border-border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-secondary"
      >
        Next
      </button>
    </div>
  );
}
