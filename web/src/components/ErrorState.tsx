interface ErrorStateProps {
  message: string;
}

export default function ErrorState({ message }: ErrorStateProps) {
  return (
    <div className="py-10 text-center">
      <p className="text-sm text-red-600">{message}</p>
    </div>
  );
}
