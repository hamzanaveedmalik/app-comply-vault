export default function ThreadLoading() {
  return (
    <div className="mx-auto max-w-4xl p-6 space-y-4">
      <div className="h-8 w-64 animate-pulse rounded bg-muted" />
      <div className="h-32 animate-pulse rounded bg-muted" />
      <div className="h-32 animate-pulse rounded bg-muted" />
    </div>
  );
}
