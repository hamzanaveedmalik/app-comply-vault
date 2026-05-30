"use client";

import { Button } from "~/components/ui/button";

export default function ComplianceCockpitError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.ReactElement {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-6">
      <h2 className="text-lg font-semibold text-text-primary">Could not load Compliance Cockpit</h2>
      <p className="max-w-md text-center text-sm text-text-secondary">{error.message}</p>
      <Button type="button" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
