"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";

type Posture = "RETAIN" | "DISCARD";

const OPTIONS: Array<{ value: Posture; title: string; consequence: string }> = [
  {
    value: "RETAIN",
    title: "Retain source media",
    consequence:
      "ComplyVault keeps the original audio or video after transcription. Reviewers can play back the recording from any evidence link. Your firm holds a second copy of client meeting media in ComplyVault storage for the full retention period.",
  },
  {
    value: "DISCARD",
    title: "Discard source media after transcription",
    consequence:
      "Once the transcript is secured and hashed, ComplyVault deletes the original audio or video and logs the deletion. Evidence links resolve to timestamped transcript segments instead of playback. Discarded media cannot be recovered or re-transcribed.",
  },
];

export function MediaPostureForm({
  workspaceId,
  currentPosture,
  postureSetAt,
  readOnly,
}: {
  workspaceId: string;
  currentPosture: Posture | null;
  postureSetAt: string | null;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Posture | null>(currentPosture);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const changingToRetain = currentPosture === "DISCARD" && selected === "RETAIN";

  const handleSave = async (): Promise<void> => {
    if (!selected) return;
    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/media-posture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ posture: selected }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Failed to save decision",
        );
      }
      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Source media retention decision</CardTitle>
        <CardDescription>
          This decision applies to meeting recordings only. Email evidence retention is
          governed separately by your correspondence policy. Ingest stays blocked until a
          decision is recorded.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!currentPosture && (
          <Alert>
            <AlertDescription>
              No decision recorded yet. Uploads and automatic ingestion are blocked for
              this workspace.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          {OPTIONS.map((option) => {
            const isSelected = selected === option.value;
            return (
              <label
                key={option.value}
                className={`flex cursor-pointer gap-3 rounded-md border p-4 ${
                  isSelected ? "border-primary bg-muted/40" : "border-input"
                } ${readOnly ? "cursor-not-allowed opacity-70" : ""}`}
              >
                <input
                  type="radio"
                  name="mediaPosture"
                  className="mt-1 h-4 w-4"
                  value={option.value}
                  checked={isSelected}
                  disabled={readOnly}
                  onChange={() => setSelected(option.value)}
                />
                <div className="space-y-1">
                  <div className="text-sm font-medium">{option.title}</div>
                  <p className="text-xs text-muted-foreground">{option.consequence}</p>
                </div>
              </label>
            );
          })}
        </div>

        {postureSetAt && (
          <p className="text-xs text-muted-foreground">
            Current decision recorded {postureSetAt}. Every change is written to the audit
            trail.
          </p>
        )}

        {changingToRetain && (
          <Alert variant="destructive">
            <AlertDescription>
              Switching to retain applies to future ingests only. Media already discarded
              under the previous policy is permanently unrecoverable.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <AlertDescription>
              Decision recorded and written to the audit trail.
            </AlertDescription>
          </Alert>
        )}

        {readOnly ? (
          <p className="text-xs text-muted-foreground">
            Only the workspace CCO can change this policy.
          </p>
        ) : (
          <Button onClick={handleSave} disabled={isSaving || !selected}>
            {isSaving ? "Saving..." : "Record decision"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
