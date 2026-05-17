"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Textarea } from "~/components/ui/textarea";
import {
  isAdvisorActor,
  isComplianceActor,
  isCcoActor,
  meetingAllowsAdvisorCertify,
  meetingAllowsCmComplete,
  meetingAllowsCcoSignOff,
  flagIsCmTriaged,
} from "~/lib/meeting-workflow";
import type { CmFlagDisposition, FlagStatus } from "../../../../../generated/prisma";

type FlagLite = {
  id: string;
  status: FlagStatus;
  cmDisposition: CmFlagDisposition;
  type: string;
  severity: string;
};

const ATTESTATION_ADVISOR =
  "I confirm that this meeting record accurately reflects the discussion that took place. Any corrections have been made above.";

const ATTESTATION_CCO =
  "I have reviewed the compliance analysis for this meeting. This sign-off covers the regulatory review and does not attest to the accuracy of the meeting record, which was certified by the advisor.";

export default function MeetingWorkflowPanel({
  meetingId,
  status,
  userRole,
  flags,
  advisorCertifiedAt,
  advisorName,
  cmReviewedAt,
  cmName,
  ccoSignedOffAt,
  ccoName,
  cmReviewSummary,
}: {
  meetingId: string;
  status: string;
  userRole: string | null | undefined;
  flags: FlagLite[];
  advisorCertifiedAt: string | null;
  advisorName: string | null;
  cmReviewedAt: string | null;
  cmName: string | null;
  ccoSignedOffAt: string | null;
  ccoName: string | null;
  cmReviewSummary: { resolved?: number; noted?: number; escalated?: number } | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revertReason, setRevertReason] = useState("");
  const [revertTo, setRevertTo] = useState<"ADVISOR_CERTIFIED" | "CM_REVIEWED">("CM_REVIEWED");

  const run = async (key: string, url: string, init?: RequestInit) => {
    setLoading(key);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        ...init,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Request failed");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(null);
    }
  };

  const allTriaged =
    flags.length === 0 ||
    flags.every((f) =>
      flagIsCmTriaged({ status: f.status, cmDisposition: f.cmDisposition }),
    );

  const pendingEscalations = flags.some((f) => f.status === "PENDING_VERIFICATION");

  return (
    <Card className="border-emerald-200 bg-emerald-50/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Three-layer sign-off</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {advisorCertifiedAt && (
          <p className="rounded-md bg-white/80 px-3 py-2 text-emerald-900">
            <strong>Advisor certified</strong>{" "}
            {advisorName ? `by ${advisorName}` : ""}{" "}
            on {new Date(advisorCertifiedAt).toLocaleString()}.
          </p>
        )}
        {cmReviewedAt && (
          <p className="rounded-md bg-white/80 px-3 py-2 text-emerald-900">
            <strong>Compliance review complete</strong>{" "}
            {cmName ? `by ${cmName}` : ""} on {new Date(cmReviewedAt).toLocaleString()}.
            {cmReviewSummary != null && (
              <span className="block text-xs text-muted-foreground mt-1">
                Resolved {cmReviewSummary.resolved ?? 0}, noted {cmReviewSummary.noted ?? 0},
                escalated {cmReviewSummary.escalated ?? 0}
              </span>
            )}
          </p>
        )}
        {ccoSignedOffAt && (
          <p className="rounded-md bg-white/80 px-3 py-2 text-emerald-900">
            <strong>CCO compliance sign-off</strong>{" "}
            {ccoName ? `by ${ccoName}` : ""} on {new Date(ccoSignedOffAt).toLocaleString()}.
          </p>
        )}

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        {isAdvisorActor(userRole as never) &&
          meetingAllowsAdvisorCertify(status as never) && (
            <div className="space-y-2 rounded-md border border-emerald-200 bg-white p-3">
              <p className="text-xs text-muted-foreground">{ATTESTATION_ADVISOR}</p>
              <Button
                type="button"
                size="sm"
                disabled={loading !== null}
                onClick={() => run("certify", `/api/meetings/${meetingId}/certify`)}
              >
                {loading === "certify" ? "Certifying…" : "Certify meeting accuracy"}
              </Button>
            </div>
          )}

        {isComplianceActor(userRole as never) &&
          meetingAllowsCmComplete(status as never) && (
            <div className="space-y-2 rounded-md border border-emerald-200 bg-white p-3">
              <p className="text-xs text-muted-foreground">
                {flags.length === 0
                  ? "No flags — confirm zero-flag review."
                  : `Triaged ${flags.filter((f) => flagIsCmTriaged(f)).length} / ${flags.length} flags.`}
              </p>
              <Button
                type="button"
                size="sm"
                disabled={loading !== null || !allTriaged}
                onClick={() => run("cm", `/api/meetings/${meetingId}/cm-review`)}
              >
                {loading === "cm" ? "Completing…" : "Complete compliance review (CM)"}
              </Button>
            </div>
          )}

        {isCcoActor(userRole as never) && meetingAllowsCcoSignOff(status as never) && (
          <div className="space-y-2 rounded-md border border-emerald-200 bg-white p-3">
            <p className="text-xs text-muted-foreground">{ATTESTATION_CCO}</p>
            {pendingEscalations && (
              <p className="text-xs text-amber-700">
                Resolve all escalated flags (via flag remediation / verification) before signing off.
              </p>
            )}
            <Button
              type="button"
              size="sm"
              disabled={loading !== null || pendingEscalations}
              onClick={() => run("cco", `/api/meetings/${meetingId}/cco-signoff`)}
            >
              {loading === "cco" ? "Signing off…" : "Sign off compliance review (CCO)"}
            </Button>
          </div>
        )}

        {isCcoActor(userRole as never) &&
          (status === "CM_REVIEWED" || status === "CCO_SIGNED_OFF" || status === "ADVISOR_CERTIFIED") && (
            <div className="space-y-2 rounded-md border border-muted bg-muted/30 p-3">
              <p className="text-xs font-medium">Revert workflow (CCO)</p>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={revertTo}
                onChange={(e) => setRevertTo(e.target.value as "ADVISOR_CERTIFIED" | "CM_REVIEWED")}
              >
                <option value="CM_REVIEWED">Back to CM reviewed</option>
                <option value="ADVISOR_CERTIFIED">Back to advisor certified</option>
              </select>
              <Textarea
                placeholder="Reason for revert (required)"
                value={revertReason}
                onChange={(e) => setRevertReason(e.target.value)}
                rows={2}
                className="text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loading !== null || revertReason.trim().length < 10}
                onClick={() =>
                  run("revert", `/api/meetings/${meetingId}/revert-workflow`, {
                    body: JSON.stringify({ revertTo, reason: revertReason.trim() }),
                  })
                }
              >
                {loading === "revert" ? "Reverting…" : "Revert workflow"}
              </Button>
            </div>
          )}
      </CardContent>
    </Card>
  );
}