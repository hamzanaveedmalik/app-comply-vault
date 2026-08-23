"use client";

import { useState } from "react";
import { StatefulButton } from "~/components/ui/stateful-button";
import { Alert, AlertDescription } from "~/components/ui/alert";

interface ExportButtonProps {
  meetingId: string;
  status: string;
  hasExtraction: boolean;
  openFlagsCount?: number;
}

export default function ExportButton({
  meetingId,
  status,
  hasExtraction,
  openFlagsCount: _openFlagsCount,
}: ExportButtonProps): React.JSX.Element | null {
  const [buttonState, setButtonState] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  if (status !== "FINALIZED" && status !== "DRAFT_READY") {
    return null;
  }

  if (!hasExtraction) {
    return (
      <Alert variant="default" className="mt-4">
        <AlertDescription>
          Extraction data is required to export. Please reprocess the meeting first.
        </AlertDescription>
      </Alert>
    );
  }

  const handleExport = async (): Promise<void> => {
    setButtonState("loading");
    setError(null);

    try {
      const response = await fetch(`/api/meetings/${meetingId}/export`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
          details?: string;
        };
        const message = data.details ?? data.error ?? "Failed to export audit pack";
        throw new Error(message);
      }

      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = "audit_pack.zip";
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1]!;
        }
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setButtonState("success");
      window.setTimeout(() => setButtonState("idle"), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
      setButtonState("error");
      window.setTimeout(() => setButtonState("idle"), 2000);
    }
  };

  return (
    <div className="mt-4 space-y-2">
      <StatefulButton
        onClick={() => void handleExport()}
        state={buttonState}
        loadingText="Exporting…"
        successText="Downloaded"
        errorText="Try again"
        disabled={buttonState === "loading"}
      >
        Export Audit Pack
      </StatefulButton>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Downloads a ZIP file with branded PDF, Evidence Map, Version History, and Transcript
      </p>
    </div>
  );
}
