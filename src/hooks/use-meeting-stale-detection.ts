"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type MeetingSyncPayload = {
  status: string;
  syncToken: string;
};

/**
 * Polls meeting sync state while collaborators may be editing.
 * Shows stale when status or underlying flag/meeting writes diverge from the last server render.
 */
export function useMeetingStaleDetection({
  meetingId,
  initialSyncToken,
  enabled,
}: {
  meetingId: string;
  initialSyncToken: string;
  enabled: boolean;
}): { stale: boolean; clearStale: () => void } {
  const router = useRouter();
  const [stale, setStale] = useState(false);
  const baselineRef = useRef(initialSyncToken);

  useEffect(() => {
    baselineRef.current = initialSyncToken;
    setStale(false);
  }, [initialSyncToken]);

  useEffect(() => {
    if (!enabled) return;

    const poll = async (): Promise<void> => {
      try {
        const res = await fetch(`/api/meetings/${meetingId}/status`);
        if (!res.ok) return;
        const data = (await res.json()) as MeetingSyncPayload & { error?: string };
        if (data.syncToken === undefined) return;
        if (data.syncToken !== baselineRef.current) {
          setStale(true);
        }
      } catch {
        /* ignore network errors */
      }
    };

    const id = window.setInterval(() => void poll(), 8000);
    void poll();
    return () => window.clearInterval(id);
  }, [meetingId, enabled]);

  const clearStale = useCallback(() => {
    setStale(false);
    router.refresh();
  }, [router]);

  return { stale, clearStale };
}
