"use client";

import { useState } from "react";

interface ExportButtonProps {
  meetingId: string;
  status: string;
  hasExtraction: boolean;
}

export default function ExportButton({
  meetingId,
  status,
  hasExtraction,
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only show export button for finalized or draft ready meetings with extraction
  if (status !== "FINALIZED" && status !== "DRAFT_READY") {
    return null;
  }

  if (!hasExtraction) {
    return (
      <div className="mt-4 rounded-md bg-yellow-50 p-3">
        <p className="text-sm text-yellow-800">
          Extraction data is required to export. Please reprocess the meeting first.
        </p>
      </div>
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
        const data = await response.json();
        throw new Error(data.error || "Failed to export audit pack");
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
    <div className="mt-4">
      <button
        onClick={handleExport}
        disabled={isExporting}
        className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isExporting ? "Exporting..." : "Export Audit Pack"}
      </button>
      {error && (
        <div className="mt-2 rounded-md bg-red-50 p-3">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
      <p className="mt-2 text-xs text-gray-500">
        Downloads a ZIP file containing PDF, CSV, and TXT exports
      </p>
    </div>
  );
}

