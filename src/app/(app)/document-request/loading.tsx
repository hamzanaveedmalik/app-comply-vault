export default function DocumentRequestLoading(): React.JSX.Element {
  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <div className="h-4 w-40 animate-pulse rounded bg-muted" />
      <div className="h-9 w-2/3 animate-pulse rounded bg-muted" />
      <div className="mt-8 h-72 animate-pulse rounded-lg bg-muted/70" />
    </main>
  );
}
