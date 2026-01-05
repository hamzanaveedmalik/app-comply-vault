"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";

interface FinalizeButtonProps {
  meetingId: string;
  meetingStatus: string;
  userRole: string | null | undefined;
}

export default function FinalizeButton({
  meetingId,
  meetingStatus,
  userRole,
}: FinalizeButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  // Only show for OWNER_CCO users and meetings in DRAFT_READY or DRAFT status
  if (userRole !== "OWNER_CCO") {
    return null;
  }

  if (meetingStatus !== "DRAFT_READY" && meetingStatus !== "DRAFT") {
    return null;
  }

  const handleFinalize = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/meetings/${meetingId}/finalize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to finalize meeting");
      }

      setIsOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-4 space-y-2">
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="default" className="w-full sm:w-auto">
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Finalize Meeting
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalize Meeting</DialogTitle>
            <DialogDescription>
              Once finalized, this meeting record will become read-only and ready for export.
              This action cannot be undone. Are you sure you want to proceed?
            </DialogDescription>
          </DialogHeader>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button onClick={handleFinalize} disabled={isLoading}>
              {isLoading ? "Finalizing..." : "Confirm Finalize"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <p className="text-xs text-muted-foreground">
        Finalizing this meeting will make it read-only and ready for export. Only workspace owners (CCO) can finalize meetings.
      </p>
    </div>
  );
}

