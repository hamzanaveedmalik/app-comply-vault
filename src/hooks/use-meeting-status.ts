"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "~/lib/toast";

interface MeetingStatus {
  id: string;
  status: string;
  clientName: string;
  draftReadyAt: string | null;
  finalizedAt: string | null;
}

interface UseMeetingStatusOptions {
  meetingId: string;
  initialStatus: string;
  enabled?: boolean;
  onStatusChange?: (newStatus: string, oldStatus: string) => void;
}

/**
 * Hook to poll for meeting status changes and show toast notifications
 */
export function useMeetingStatus({
  meetingId,
  initialStatus,
  enabled = true,
  onStatusChange,
}: UseMeetingStatusOptions) {
  const [status, setStatus] = useState(initialStatus);
  const [isPolling, setIsPolling] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!enabled || status === "FINALIZED" || status === "DRAFT_READY") {
      return;
    }

    setIsPolling(true);
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/meetings/${meetingId}/status`);
        if (!response.ok) {
          return;
        }

        const data: MeetingStatus = await response.json();
        const newStatus = data.status;

        if (newStatus !== status) {
          const oldStatus = status;
          setStatus(newStatus);

          // Show toast notification
          if (newStatus === "DRAFT_READY") {
            toast.success("Meeting Processing Complete", {
              description: `${data.clientName} is ready for review`,
              action: {
                label: "View",
                onClick: () => router.push(`/meetings/${meetingId}`),
              },
            });
          } else if (newStatus === "FINALIZED") {
            toast.success("Meeting Finalized", {
              description: `${data.clientName} has been finalized`,
              action: {
                label: "View",
                onClick: () => router.push(`/meetings/${meetingId}`),
              },
            });
          } else if (newStatus === "ERROR") {
            toast.error("Processing Failed", {
              description: `${data.clientName} processing encountered an error`,
            });
          }

          // Call custom callback
          if (onStatusChange) {
            onStatusChange(newStatus, oldStatus);
          }

          // Refresh the page to show updated content
          router.refresh();
        }
      } catch (error) {
        console.error("Error polling meeting status:", error);
      }
    }, 5000); // Poll every 5 seconds

    return () => {
      clearInterval(pollInterval);
      setIsPolling(false);
    };
  }, [meetingId, status, enabled, router, onStatusChange]);

  return { status, isPolling };
}

