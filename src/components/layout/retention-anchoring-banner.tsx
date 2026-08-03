"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";

/**
 * CV-TR-04a — one-time notice that retention is now anchored to fiscal year end.
 */
export function RetentionAnchoringBanner({
  workspaceId,
  fiscalYearEndLabel,
  retentionYears,
}: {
  workspaceId: string;
  fiscalYearEndLabel: string;
  retentionYears: number;
}) {
  const router = useRouter();
  const [dismissing, setDismissing] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (dismissed) return null;

  const handleDismiss = async (): Promise<void> => {
    setDismissing(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/retention-notice/dismiss`,
        { method: "POST" },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Failed to dismiss",
        );
      }
      setDismissed(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setDismissing(false);
    }
  };

  return (
    <div className="border-b border-sky-300 bg-sky-50 px-4 py-2 text-sm text-sky-950">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
        <p>
          <span className="font-medium">Retention:</span> {retentionYears} years from fiscal
          year end ({fiscalYearEndLabel}).{" "}
          <Link
            href="/settings/workspace"
            className="font-medium underline underline-offset-2"
          >
            Workspace settings
          </Link>
          {error ? <span className="ml-2 text-destructive">{error}</span> : null}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 border-sky-400 bg-white"
          disabled={dismissing}
          onClick={() => void handleDismiss()}
        >
          {dismissing ? "Dismissing..." : "Got it"}
        </Button>
      </div>
    </div>
  );
}
