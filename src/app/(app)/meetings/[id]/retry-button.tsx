"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { RefreshCw, Upload } from "lucide-react";
import { toast } from "sonner";

interface RetryButtonProps {
  meetingId: string;
  status: string;
  hasFile: boolean;
  type?: "upload" | "processing";
}

export default function RetryButton({
  meetingId,
  status,
  hasFile,
  type = "processing",
}: RetryButtonProps) {
  const router = useRouter();
  const [isRetrying, setIsRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only show retry button for failed/error states
  const shouldShow =
    (type === "upload" && status === "UPLOADING") ||
    (type === "processing" && (status === "PROCESSING" || status === "DRAFT_READY" || status === "DRAFT"));

  if (!shouldShow) {
    return null;
  }

  const handleRetry = async () => {
    if (!confirm(`Are you sure you want to retry ${type === "upload" ? "upload" : "processing"}?`)) {
      return;
    }

    setIsRetrying(true);
    setError(null);

    try {
      const response = await fetch(`/api/meetings/${meetingId}/retry`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || data.message || "Failed to retry");
      }

      const data = await response.json();
      toast.success(data.message || "Retry initiated successfully");
      
      // Refresh the page to show updated status
      router.refresh();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
      setError(errorMessage);
      toast.error(errorMessage);
      setIsRetrying(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        onClick={handleRetry}
        disabled={isRetrying || !hasFile}
        variant="outline"
        className="w-full sm:w-auto"
      >
        {isRetrying ? (
          <>
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            Retrying...
          </>
        ) : (
          <>
            {type === "upload" ? (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Retry Upload
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry Processing
              </>
            )}
          </>
        )}
      </Button>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {!hasFile && type === "processing" && (
        <Alert>
          <AlertDescription>
            Cannot retry processing: no file found. Please upload a file first.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

