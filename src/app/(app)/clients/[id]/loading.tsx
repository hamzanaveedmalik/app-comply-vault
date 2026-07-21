export default function ClientDetailLoading() {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="h-8 w-56 animate-pulse rounded bg-muted" />
      <div className="mt-2 h-4 w-40 animate-pulse rounded bg-muted" />
      <div className="mt-8 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded bg-muted" />
        ))}
      </div>
    </div>
  );
}
