"use client";

import { Button } from "~/components/ui/button";

export default function NeedsAttentionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.JSX.Element {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <h2 className="text-lg font-semibold text-destructive">Could not load Needs Attention</h2>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      <Button type="button" variant="outline" className="mt-4" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
