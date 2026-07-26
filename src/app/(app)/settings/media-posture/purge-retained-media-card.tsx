"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Input } from "~/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

type PurgeSummary = {
  eligible: number;
  purged: number;
  skippedNoTranscript: number;
  failed: number;
};

export function PurgeRetainedMediaCard({
  workspaceId,
  retainedCount,
}: {
  workspaceId: string;
  retainedCount: number;
}) {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [isPurging, setIsPurging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<PurgeSummary | null>(null);

  const handlePurge = async (): Promise<void> => {
    setIsPurging(true);
    setError(null);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/media-purge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "PURGE" }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Failed to purge media",
        );
      }
      setSummary(data.data as PurgeSummary);
      setConfirmText("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsPurging(false);
    }
  };

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle>Retained media under a discard policy</CardTitle>
        <CardDescription>
          {retainedCount} meeting{retainedCount === 1 ? "" : "s"} still hold source media
          ingested before the discard policy took effect. Your recorded policy says the
          firm does not retain media, so leaving these in place is an inconsistency an
          examiner can raise. Purging is a separate, audited action — it was deliberately
          not performed when the policy changed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="destructive">
          <AlertDescription>
            Purged media cannot be recovered or re-transcribed. Each deletion is verified
            against the stored transcript hash first; meetings without a secured
            transcript are skipped and reported. Every deletion is written to the audit
            trail.
          </AlertDescription>
        </Alert>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {summary && (
          <Alert>
            <AlertDescription>
              Purge complete: {summary.purged} of {summary.eligible} deleted
              {summary.skippedNoTranscript > 0 &&
                `, ${summary.skippedNoTranscript} skipped (no secured transcript)`}
              {summary.failed > 0 && `, ${summary.failed} failed`}. Details are in the
              audit trail.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Type <span className="font-mono font-semibold">PURGE</span> to confirm.
          </p>
          <div className="flex gap-2">
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="PURGE"
              className="max-w-40"
            />
            <Button
              variant="destructive"
              onClick={handlePurge}
              disabled={isPurging || confirmText !== "PURGE"}
            >
              {isPurging ? "Purging..." : "Purge retained media"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
