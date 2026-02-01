interface LoadingStateProps {
  message?: string;
}

export default function LoadingState({ message = 'Loading...' }: LoadingStateProps) {
  return (
    <div className="py-12 text-center text-text-tertiary text-sm">
      <div className="inline-flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-brand-orange animate-pulse" />
        <span>{message}</span>
      </div>
    </div>
  );
}
