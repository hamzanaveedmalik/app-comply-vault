export default function CommunicationsLoading() {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="mt-6 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded bg-muted" />
        ))}
      </div>
    </div>
  );
}
