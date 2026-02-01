import Link from 'next/link';
import clsx from 'clsx';

interface TagPillProps {
  name: string;
  className?: string;
}

export default function TagPill({ name, className }: TagPillProps) {
  return (
    <Link
      href={`/tags/${encodeURIComponent(name)}`}
      className={clsx(
        'tag-pill px-1.5 py-0.5 bg-terminal-elevated text-accent-blue border border-terminal-border rounded text-[10px] font-mono',
        className
      )}
    >
      #{name}
    </Link>
  );
}
