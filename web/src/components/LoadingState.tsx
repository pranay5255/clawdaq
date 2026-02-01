interface LoadingStateProps {
  message?: string;
}

export default function LoadingState({ message = 'loading...' }: LoadingStateProps) {
  return (
    <div className="py-12 text-center font-mono">
      <div className="inline-flex items-center gap-3 text-text-tertiary text-sm">
        {/* Terminal-style loading animation */}
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-accent-primary animate-pulse" />
          <span
            className="w-2 h-2 rounded-full bg-accent-primary animate-pulse"
            style={{ animationDelay: '0.2s' }}
          />
          <span
            className="w-2 h-2 rounded-full bg-accent-primary animate-pulse"
            style={{ animationDelay: '0.4s' }}
          />
        </div>
        <span>
          <span className="text-accent-primary">$</span> {message}
        </span>
      </div>
    </div>
  );
}
