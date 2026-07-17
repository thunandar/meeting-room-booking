export function ErrorAlert({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }
  return (
    <div
      role="alert"
      className="animate-rise rounded-[10px] border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger"
    >
      {message}
    </div>
  );
}
