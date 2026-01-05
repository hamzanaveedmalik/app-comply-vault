"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ReprocessButtonProps {
  meetingId: string;
  hasTranscript: boolean;
  hasExtraction: boolean;
}

export default function ReprocessButton({
  meetingId,
  hasTranscript,
  hasExtraction,
}: ReprocessButtonProps) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only show button if meeting has transcript
  if (!hasTranscript) {
    return null;
  }

  const handleReprocess = async () => {
    if (!confirm("Are you sure you want to reprocess extraction for this meeting? This will overwrite any existing extraction data.")) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch(`/api/meetings/${meetingId}/reprocess`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || data.message || "Failed to reprocess meeting");
      }

      // Refresh the page to show updated extraction data
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
      setIsProcessing(false);
    }
  };

  return (
    <div className="mt-4">
      <button
        onClick={handleReprocess}
        disabled={isProcessing}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isProcessing ? "Reprocessing..." : hasExtraction ? "Reprocess Extraction" : "Run Extraction"}
      </button>
      {error && (
        <div className="mt-2 rounded-md bg-red-50 p-3">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
    </div>
  );
}

