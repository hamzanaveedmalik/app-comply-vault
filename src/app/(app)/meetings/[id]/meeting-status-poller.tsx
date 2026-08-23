"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMeetingStatus } from "~/hooks/use-meeting-status";
import { toast } from "~/lib/toast";

interface MeetingStatusPollerProps {
  meetingId: string;
  initialStatus: string;
  clientName: string;
}

/**
 * Component to poll for meeting status changes and show toast notifications
 */
export function MeetingStatusPoller({
  meetingId,
  initialStatus,
  clientName,
}: MeetingStatusPollerProps) {
  const router = useRouter();

  useMeetingStatus({
    meetingId,
    initialStatus,
    enabled: initialStatus === "PROCESSING" || initialStatus === "UPLOADING",
    onStatusChange: (newStatus, oldStatus) => {
      if (newStatus === "DRAFT_READY" && oldStatus === "PROCESSING") {
        // Status change will trigger toast in the hook
        // Refresh to show updated content
        router.refresh();
      }
    },
  });

  return null; // This component doesn't render anything
}

