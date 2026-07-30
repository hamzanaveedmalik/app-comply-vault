"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Textarea } from "~/components/ui/textarea";
import type {
  CandidatePackDto,
} from "~/server/candidate-pack/service";
import type { InterpretedScope } from "~/server/candidate-pack/types";

type ApiResult<T> = { success: boolean; data?: T; error?: string };

async function request<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const payload = (await response.json()) as ApiResult<T>;
  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.error ?? "Could not complete the candidate-pack step.");
  }
  return payload.data;
}

function ScopeList({ label, values }: { label: string; values: string[] }): React.JSX.Element {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm text-foreground">{values.length ? values.join(", ") : "None interpreted"}</p>
    </div>
  );
}

export function CandidatePackClient(): React.JSX.Element {
  const [requestText, setRequestText] = useState("");
  const [pack, setPack] = useState<CandidatePackDto | null>(null);
  const [scope, setScope] = useState<InterpretedScope | null>(null);
  const [pending, setPending] = useState<"draft" | "confirm" | "generate" | "approve" | null>(null);

  async function createDraft(): Promise<void> {
    setPending("draft");
    try {
      const data = await request<CandidatePackDto>("/api/candidate-pack", {
        method: "POST",
        body: JSON.stringify({ requestText }),
      });
      setPack(data);
      setScope(data.interpretedScope);
      toast.success("Candidate scope interpretation created.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create candidate scope.");
    } finally {
      setPending(null);
    }
  }

  async function confirmScope(): Promise<void> {
    if (!pack || !scope) return;
    setPending("confirm");
    try {
      const data = await request<CandidatePackDto>(`/api/candidate-pack/${pack.id}/confirm`, {
        method: "POST",
        body: JSON.stringify({ scope }),
      });
      setPack(data);
      setScope(data.interpretedScope);
      toast.success("Candidate scope confirmed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not confirm candidate scope.");
    } finally {
      setPending(null);
    }
  }

  async function generate(): Promise<void> {
    if (!pack) return;
    setPending("generate");
    try {
      const data = await request<CandidatePackDto>(`/api/candidate-pack/${pack.id}/generate`, {
        method: "POST",
      });
      setPack(data);
      toast.success("Candidate pack generated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate candidate pack.");
    } finally {
      setPending(null);
    }
  }

  async function approve(): Promise<void> {
    if (!pack) return;
    setPending("approve");
    try {
      const data = await request<CandidatePackDto>(`/api/candidate-pack/${pack.id}/approve`, {
        method: "POST",
      });
      setPack(data);
      toast.success("Candidate pack approved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not approve candidate pack.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>1. Request item</CardTitle>
          <CardDescription>Use one request item at a time.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={requestText}
            onChange={(event) => setRequestText(event.target.value)}
            placeholder="Paste a document-request item…"
            rows={6}
            disabled={Boolean(pack)}
          />
          {!pack ? (
            <Button onClick={() => void createDraft()} disabled={pending === "draft"}>
              {pending === "draft" ? "Interpreting…" : "Interpret candidate scope"}
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {pack && scope ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>2. Interpreted candidate scope</CardTitle>
                <CardDescription>
                  Confirm or edit this scope. Generation remains unavailable until it is confirmed.
                </CardDescription>
              </div>
              <Badge variant="outline">{pack.status.replaceAll("_", " ")}</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <ScopeList label="People" values={scope.people} />
            <ScopeList label="Entities" values={scope.entities} />
            <ScopeList label="Channels" values={scope.channels} />
            <ScopeList label="Concepts" values={scope.concepts} />
            <ScopeList label="Exclusions" values={scope.exclusions} />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Date range</p>
              <p className="mt-1 text-sm text-foreground">
                {scope.dateFrom ?? "Not interpreted"} to {scope.dateTo ?? "Not interpreted"}
              </p>
            </div>
            {pack.status === "DRAFT_SCOPE" ? (
              <div className="md:col-span-2">
                <Button onClick={() => void confirmScope()} disabled={pending === "confirm"}>
                  {pending === "confirm" ? "Confirming…" : "Confirm candidate scope"}
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {pack?.status === "SCOPE_CONFIRMED" || pack?.status === "GENERATED" || pack?.status === "APPROVED" ? (
        <Card>
          <CardHeader>
            <CardTitle>3. Candidate evidence</CardTitle>
            <CardDescription>Retrieval uses only the confirmed candidate scope.</CardDescription>
          </CardHeader>
          <CardContent>
            {pack.status === "SCOPE_CONFIRMED" ? (
              <Button onClick={() => void generate()} disabled={pending === "generate"}>
                {pending === "generate" ? "Generating…" : "Generate candidate pack"}
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                {pack.meetingIds.length} meeting record(s) and {pack.emailEvidenceIds.length} email evidence item(s) are included.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {pack?.coverageStatement ? (
        <Card>
          <CardHeader>
            <CardTitle>4. Coverage statement</CardTitle>
            <CardDescription>Known gaps and unavailable sources remain visible.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pack.coverageStatement.map((item) => (
              <div key={item.label} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{item.label}</p>
                  <Badge variant="outline">{item.status.replaceAll("_", " ")}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
              </div>
            ))}
            {pack.status === "GENERATED" ? (
              <Button onClick={() => void approve()} disabled={pending === "approve"}>
                {pending === "approve" ? "Approving…" : "Approve candidate pack"}
              </Button>
            ) : null}
            {pack.status === "APPROVED" ? (
              <p className="text-sm font-medium text-brand">Candidate pack approved for export use.</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
