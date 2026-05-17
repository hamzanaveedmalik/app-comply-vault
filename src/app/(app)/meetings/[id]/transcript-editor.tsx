"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TranscriptSegment } from "~/server/transcription/types";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Textarea } from "~/components/ui/textarea";

export default function TranscriptEditor({
  meetingId,
  segments: initialSegments,
  canEdit,
}: {
  meetingId: string;
  segments: TranscriptSegment[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [segments, setSegments] = useState(initialSegments);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!canEdit) {
    return null;
  }

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/transcript`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segments }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Save failed");
      }
      setMessage("Transcript saved.");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-dashed border-primary/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Edit transcript (advisor)</CardTitle>
        <p className="text-xs text-muted-foreground">
          Correct speaker labels or text before certifying accuracy. Save before certifying.
        </p>
      </CardHeader>
      <CardContent className="space-y-3 max-h-[360px] overflow-y-auto">
        {segments.map((seg, index) => (
          <div key={index} className="space-y-1 rounded-md border p-2">
            <div className="text-xs text-muted-foreground">
              {Math.floor(seg.startTime / 60)}:
              {String(Math.floor(seg.startTime % 60)).padStart(2, "0")} · {seg.speaker}
            </div>
            <Textarea
              value={seg.text}
              onChange={(ev) => {
                const next = [...segments];
                next[index] = { ...seg, text: ev.target.value };
                setSegments(next);
              }}
              rows={2}
              className="text-sm"
            />
          </div>
        ))}
        <div className="flex items-center gap-2 pt-2">
          <Button type="button" size="sm" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save transcript"}
          </Button>
          {message && <span className="text-xs text-muted-foreground">{message}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
