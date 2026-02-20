"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";
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
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only show export button for finalized or draft ready meetings with extraction
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

  const handleExport = async () => {
    setIsExporting(true);
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

      // Get filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = "audit_pack.zip";
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1]!;
        }
      }

      // Download the ZIP file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="mt-4 space-y-2">
      <Button
        onClick={handleExport}
        disabled={isExporting}
        variant="default"
      >
        {isExporting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Exporting...
          </>
        ) : (
          "Export Audit Pack"
        )}
      </Button>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <p className="text-xs text-muted-foreground">
        Downloads a ZIP file with branded PDF, Evidence Map, Version History, and Transcript
      </p>
    </div>
  );
}

