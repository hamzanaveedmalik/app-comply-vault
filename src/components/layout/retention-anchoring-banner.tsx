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
    <div className="border-b border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-950">
      <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-medium">Retention is now anchored to your fiscal year end</p>
          <p>
            Records are retained for {retentionYears} years from the end of the fiscal year
            in which they were sealed (currently {fiscalYearEndLabel}), matching how Rule
            204-2 measures the period. Your previous floor was preserved — retention was
            never shortened. To lengthen the period or change the fiscal year end, update{" "}
            <Link
              href="/settings/workspace"
              className="font-medium underline underline-offset-2"
            >
              workspace settings
            </Link>
            .
          </p>
          {error && <p className="text-destructive">{error}</p>}
        </div>
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
