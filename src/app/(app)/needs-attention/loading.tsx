export default function NeedsAttentionLoading(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="h-8 w-56 animate-pulse rounded bg-muted" />
      <div className="mt-6 space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-56 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
