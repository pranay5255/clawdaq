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
        'tag-pill px-1.5 py-0.5 bg-accent-blue-light text-accent-blue rounded text-xs font-medium',
        className
      )}
    >
      {name}
    </Link>
  );
}
