"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Textarea } from "~/components/ui/textarea";
import { Badge } from "~/components/ui/badge";
import { flagIsCmTriaged } from "~/lib/meeting-workflow";
import type { CmFlagDisposition, FlagStatus } from "../../../../../generated/prisma";

export type CmTriageFlag = {
  id: string;
  type: string;
  severity: string;
  status: FlagStatus;
  cmDisposition: CmFlagDisposition;
  escalationReason?: string | null;
  cmTriageNote?: string | null;
};

export default function CmFlagTriageList({ meetingId, flags }: { meetingId: string; flags: CmTriageFlag[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [resolveNotes, setResolveNotes] = useState<Record<string, string>>({});
  const [noteTexts, setNoteTexts] = useState<Record<string, string>>({});
  const [escalationTexts, setEscalationTexts] = useState<Record<string, string>>({});

  const triage = async (flagId: string, body: object) => {
    setLoadingId(flagId);
    try {
      const res = await fetch(`/api/flags/${flagId}/cm-triage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Triage failed");
      }
      router.refresh();
    } finally {
      setLoadingId(null);
    }
  };

  if (flags.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Compliance flag triage</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No flags for this meeting. Complete CM review when ready.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Compliance flag triage (CM)</CardTitle>
        <p className="text-xs text-muted-foreground">
          Resolve, add a note, or escalate each flag. Progress applies to the quick triage path for open flags.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {flags.map((flag) => {
          const done = flagIsCmTriaged({ status: flag.status, cmDisposition: flag.cmDisposition });
          return (
            <div key={flag.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{flag.type.replace(/_/g, " ")}</Badge>
                <Badge variant={flag.severity === "CRITICAL" ? "destructive" : "secondary"}>
                  {flag.severity}
                </Badge>
                <span className="text-xs text-muted-foreground">{flag.status}</span>
                {done && (
                  <Badge variant="default" className="bg-emerald-700">
                    Triaged ({flag.cmDisposition})
                  </Badge>
                )}
              </div>
              {!done && flag.status === "OPEN" && (
                <div className="space-y-2 border-t pt-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <div className="flex-1 min-w-[200px] space-y-1">
                      <label className="text-xs font-medium">Resolve — note (min 10 chars)</label>
                      <Textarea
                        value={resolveNotes[flag.id] ?? ""}
                        onChange={(e) => setResolveNotes((m) => ({ ...m, [flag.id]: e.target.value }))}
                        rows={2}
                        className="text-xs"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={loadingId === flag.id || (resolveNotes[flag.id]?.length ?? 0) < 10}
                        onClick={() =>
                          triage(flag.id, {
                            action: "resolve",
                            resolutionNote: resolveNotes[flag.id]?.trim() ?? "",
                          })
                        }
                      >
                        Resolve
                      </Button>
                    </div>
                    <div className="flex-1 min-w-[200px] space-y-1">
                      <label className="text-xs font-medium">Note only</label>
                      <Textarea
                        value={noteTexts[flag.id] ?? ""}
                        onChange={(e) => setNoteTexts((m) => ({ ...m, [flag.id]: e.target.value }))}
                        rows={2}
                        className="text-xs"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={loadingId === flag.id || (noteTexts[flag.id]?.length ?? 0) < 5}
                        onClick={() =>
                          triage(flag.id, {
                            action: "note",
                            cmTriageNote: noteTexts[flag.id]?.trim() ?? "",
                          })
                        }
                      >
                        Add note
                      </Button>
                    </div>
                    <div className="flex-1 min-w-[200px] space-y-1">
                      <label className="text-xs font-medium">Escalate to CCO</label>
                      <Textarea
                        value={escalationTexts[flag.id] ?? ""}
                        onChange={(e) => setEscalationTexts((m) => ({ ...m, [flag.id]: e.target.value }))}
                        rows={2}
                        className="text-xs"
                        placeholder="Why does CCO need to weigh in?"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={loadingId === flag.id || (escalationTexts[flag.id]?.length ?? 0) < 10}
                        onClick={() =>
                          triage(flag.id, {
                            action: "escalate",
                            escalationReason: escalationTexts[flag.id]?.trim() ?? "",
                          })
                        }
                      >
                        Escalate
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              {!done && flag.status !== "OPEN" && (
                <p className="text-xs text-amber-800">
                  This flag is not OPEN — use the full remediation panel below.
                </p>
              )}
              {flag.cmTriageNote && (
                <p className="text-xs text-muted-foreground">CM note: {flag.cmTriageNote}</p>
              )}
              {flag.escalationReason && (
                <p className="text-xs text-amber-900">Escalation: {flag.escalationReason}</p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
