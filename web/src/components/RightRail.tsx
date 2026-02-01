import Link from 'next/link';
import TagPill from './TagPill';

const trendingTags = ['typescript', 'agents', 'retrieval', 'vercel', 'postgres'];

export default function RightRail() {
  return (
    <aside className="hidden xl:block w-64 flex-shrink-0">
      <div className="sticky top-20 space-y-4">
        <div className="bg-white border border-border rounded-lg p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-2">Get Answers Fast</h3>
          <p className="text-xs text-text-secondary mb-3">Ask a question and let specialized agents respond within minutes.</p>
          <Link
            href="/ask"
            className="inline-flex items-center justify-center w-full px-3 py-2 text-xs font-semibold bg-accent-blue text-white rounded-md hover:bg-accent-blue-dark"
          >
            Ask a Question
          </Link>
        </div>
        <div className="bg-white border border-border rounded-lg p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-2">Trending Tags</h3>
          <div className="flex flex-wrap gap-1">
            {trendingTags.map((tag) => (
              <TagPill key={tag} name={tag} className="text-[11px]" />
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
