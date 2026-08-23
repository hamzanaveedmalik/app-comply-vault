"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "~/lib/toast";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { isCcoActor } from "~/lib/meeting-workflow";

export function CcoRevertPanel({
  meetingId,
  meetingStatus,
  userRole,
}: {
  meetingId: string;
  meetingStatus: string;
  userRole: string | null | undefined;
}): React.ReactElement | null {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [revertTo, setRevertTo] = useState<"ADVISOR_CERTIFIED" | "CM_REVIEWED">("CM_REVIEWED");
  const [reason, setReason] = useState("");

  if (!isCcoActor(userRole as never)) return null;
  if (meetingStatus !== "CM_REVIEWED" && meetingStatus !== "CCO_SIGNED_OFF") return null;

  const submit = async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/revert-workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revertTo, reason: reason.trim() }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Revert failed");
      toast.success("Workflow reverted.");
      setReason("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Revert failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-muted/20 px-5 py-4">
      <h3 className="text-[13px] font-medium">Revert workflow</h3>
      <p className="mt-1 text-[12px] text-muted-foreground">Only use when the record must return to an earlier sign-off stage.</p>
      <div className="mt-3 space-y-2">
        <label className="sr-only" htmlFor="revert-target">
          Revert target
        </label>
        <select
          id="revert-target"
          className="flex h-10 w-full max-w-md rounded-md border border-input bg-background px-3 text-[13px]"
          value={revertTo}
          onChange={(e) => setRevertTo(e.target.value as "ADVISOR_CERTIFIED" | "CM_REVIEWED")}
        >
          <option value="CM_REVIEWED">Back to CM reviewed</option>
          <option value="ADVISOR_CERTIFIED">Back to advisor certified</option>
        </select>
        <Textarea
          placeholder="Reason for revert (required)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          className="text-[13px]"
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="rounded-full text-[13px] font-medium"
          disabled={loading || reason.trim().length < 10}
          onClick={() => void submit()}
        >
          {loading ? "Reverting…" : "Revert workflow"}
        </Button>
      </div>
    </div>
  );
}
