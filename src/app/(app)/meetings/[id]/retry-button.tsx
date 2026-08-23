"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { RefreshCw, Upload } from "lucide-react";
import { toast } from "~/lib/toast";
import {
  StatefulButton,
  pendingButtonState,
  type ButtonState,
} from "~/components/ui/stateful-button";

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
}: RetryButtonProps): React.JSX.Element | null {
  const router = useRouter();
  const [buttonState, setButtonState] = useState<ButtonState>("idle");
  const [error, setError] = useState<string | null>(null);

  const shouldShow =
    (type === "upload" && status === "UPLOADING") ||
    (type === "processing" && (status === "PROCESSING" || status === "DRAFT_READY" || status === "DRAFT"));

  if (!shouldShow) {
    return null;
  }

  const handleRetry = async (): Promise<void> => {
    if (!confirm(`Are you sure you want to retry ${type === "upload" ? "upload" : "processing"}?`)) {
      return;
    }

    setButtonState("loading");
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
      setButtonState("success");
      window.setTimeout(() => setButtonState("idle"), 1500);
      router.refresh();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
      setError(errorMessage);
      toast.error(errorMessage);
      setButtonState("error");
      window.setTimeout(() => setButtonState("idle"), 2000);
    }
  };

  return (
    <div className="space-y-2">
      <StatefulButton
        onClick={() => void handleRetry()}
        state={buttonState}
        loadingText="Retrying…"
        successText="Queued"
        errorText="Try again"
        variant="outline"
        className="w-full sm:w-auto"
        disabled={!hasFile || buttonState === "loading"}
        icon={
          type === "upload" ? (
            <Upload className="h-4 w-4" aria-hidden />
          ) : (
            <RefreshCw className="h-4 w-4" aria-hidden />
          )
        }
      >
        {type === "upload" ? "Retry Upload" : "Retry Processing"}
      </StatefulButton>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {!hasFile && type === "processing" ? (
        <Alert>
          <AlertDescription>
            Cannot retry processing: no file found. Please upload a file first.
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
