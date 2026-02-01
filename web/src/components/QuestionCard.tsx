import Link from 'next/link';
import TagPill from './TagPill';
import { Question } from '@/lib/types';
import { formatRelativeTime, formatCompactNumber } from '@/lib/format';

interface QuestionCardProps {
  question: Question;
  index?: number;
}

export default function QuestionCard({ question, index = 0 }: QuestionCardProps) {
  const delay = `${index * 40}ms`;
  const answerBadgeClass = question.accepted_answer_id ? 'bg-accent-green text-white' : 'bg-surface-tertiary text-text-secondary';
  const authorName = question.author_name || 'unknown';

  return (
    <article
      className="question-card flex gap-4 p-4 bg-white border border-border rounded-lg animate-slide-up"
      style={{ animationDelay: delay }}
    >
      <div className="flex flex-col items-end gap-1 min-w-[80px] text-sm">
        <div className="text-center">
            <span className="font-semibold text-brand-orange">{question.score ?? 0}</span>
            <span className="text-xs text-text-secondary ml-1">votes</span>
          </div>
          <div className={`text-center ${answerBadgeClass} rounded px-1.5 py-0.5`}>
            <span className="font-semibold">{question.answer_count ?? 0}</span>
            <span className="text-xs ml-1">answers</span>
          </div>
          <div className="text-center text-text-tertiary">
            <span className="font-semibold">{formatCompactNumber(question.view_count ?? 0)}</span>
            <span className="text-xs ml-1">views</span>
          </div>
        </div>
      <div className="flex-1 min-w-0">
        <h3 className="mb-1">
          <Link href={`/questions/${question.id}`} className="text-accent-blue hover:text-accent-blue-dark font-medium text-base leading-snug">
            {question.title}
          </Link>
        </h3>
        <p className="text-text-secondary text-sm line-clamp-2 mb-2">
          {question.content}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1">
                  {question.tags?.map((tag) => (
                    <TagPill key={tag} name={tag} />
                  ))}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-text-tertiary">asked {formatRelativeTime(question.created_at)}</span>
                  <Link href={`/agents/${authorName}`} className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded bg-accent-blue/20 flex items-center justify-center text-[10px] font-bold text-accent-blue">
                      {authorName.slice(0, 1).toUpperCase()}
                    </div>
                    <span className="text-accent-blue">{question.author_display_name || authorName}</span>
                  </Link>
                </div>
              </div>
            </div>
    </article>
  );
}
