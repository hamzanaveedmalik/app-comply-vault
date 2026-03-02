"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";

const PROVIDER_LABELS: Record<string, string> = {
  ZOOM: "Zoom",
  TEAMS: "Teams",
  SHAREPOINT: "SharePoint",
  GOOGLE_DRIVE: "Google Drive",
  REDTAIL: "Redtail",
  WEALTHBOX: "Wealthbox",
  DOCUSIGN: "DocuSign",
  RIA_IN_A_BOX: "RIA in a Box",
  SLACK: "Slack",
};

type SyncStatus = {
  provider: string;
  status: "Synced" | "Pending" | "Failed";
  lastSyncAt: string | null;
  errorMessage: string | null;
  action: string;
};

export function IntegrationSyncPanel({
  meetingId,
  syncStatuses,
}: {
  meetingId: string;
  syncStatuses: SyncStatus[];
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();

  async function handleRetry(provider: string, action: string) {
    setLoading(provider);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/integration-sync/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, action }),
      });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Retry failed");
    } finally {
      setLoading(null);
    }
  }

  if (syncStatuses.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Integration Sync Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {syncStatuses.map((s) => (
            <div
              key={`${s.provider}-${s.action}`}
              className="flex items-center justify-between rounded border p-3"
            >
              <div>
                <p className="font-medium text-sm">
                  {PROVIDER_LABELS[s.provider] ?? s.provider} — {s.action}
                </p>
                <p className="text-xs text-muted-foreground">
                  {s.status === "Synced" && s.lastSyncAt
                    ? `Synced ${new Date(s.lastSyncAt).toLocaleString()}`
                    : s.status === "Failed"
                      ? s.errorMessage ?? "Failed"
                      : "Pending"}
                </p>
              </div>
              {s.status === "Failed" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRetry(s.provider, s.action)}
                  disabled={loading === s.provider}
                >
                  {loading === s.provider ? "Retrying…" : "Retry"}
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
