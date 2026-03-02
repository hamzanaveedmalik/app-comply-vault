"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";

const PROVIDER_LABELS: Record<string, string> = {
  ZOOM: "Zoom",
  TEAMS: "Microsoft Teams",
  SHAREPOINT: "SharePoint",
  GOOGLE_DRIVE: "Google Drive",
  SMARTVAULT: "SmartVault",
  REDTAIL: "Redtail CRM",
  WEALTHBOX: "Wealthbox",
  SALESFORCE: "Salesforce",
  DOCUSIGN: "DocuSign",
  RIA_IN_A_BOX: "RIA in a Box",
  COMPLYSCI: "ComplySci",
  SLACK: "Slack",
  TEAMS_BOT: "Teams Bot",
};

const STATUS_LABELS: Record<string, string> = {
  CONNECTED: "Live",
  WARNING_RETRYING: "Attention",
  ERROR_ACTION_REQUIRED: "Error",
  NOT_CONNECTED: "Not Connected",
};

const STATUS_STYLES: Record<string, string> = {
  CONNECTED: "bg-green-100 text-green-800",
  WARNING_RETRYING: "bg-amber-100 text-amber-800",
  ERROR_ACTION_REQUIRED: "bg-red-100 text-red-800",
  NOT_CONNECTED: "bg-gray-100 text-gray-600",
};

type Integration = {
  id: string;
  provider: string;
  status: string;
  expiresAt: string | null;
  lastSyncAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  connectedAt: string;
};

type Failure = {
  id: string;
  meetingId: string | null;
  action: string;
  errorMessage: string | null;
  attempts: number;
  createdAt: string;
};

export function IntegrationsClient({
  workspaceId,
  initialIntegrations,
}: {
  workspaceId: string;
  initialIntegrations: Integration[];
}) {
  const [integrations, setIntegrations] = useState(initialIntegrations);
  const [expandedFailures, setExpandedFailures] = useState<string | null>(null);
  const [failures, setFailures] = useState<Record<string, Failure[]>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();

  async function handleDisconnect(credentialId: string) {
    if (!confirm("Disconnect this integration? Credentials and config will be removed. Audit packs are unchanged.")) return;
    setLoading(credentialId);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/integrations/${credentialId}/disconnect`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(await res.text());
      setIntegrations((prev) => prev.filter((i) => i.id !== credentialId));
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to disconnect");
    } finally {
      setLoading(null);
    }
  }

  async function toggleFailures(credentialId: string) {
    if (expandedFailures === credentialId) {
      setExpandedFailures(null);
      return;
    }
    if (!failures[credentialId]) {
      const res = await fetch(`/api/workspaces/${workspaceId}/integrations/${credentialId}/failures`);
      if (res.ok) {
        const { failures: f } = await res.json();
        setFailures((prev) => ({ ...prev, [credentialId]: f }));
      }
    }
    setExpandedFailures(credentialId);
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Connect your tools to automatically sync audit packs, send notifications, and more.
      </p>

      {integrations.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          <p>No integrations connected yet.</p>
          <p className="text-sm mt-2">
            Integration connections (Zoom, Teams, SharePoint, etc.) will appear here once configured.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {integrations.map((int) => (
            <div key={int.id} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {PROVIDER_LABELS[int.provider] ?? int.provider}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Connected {new Date(int.connectedAt).toLocaleDateString()}
                    {int.lastSyncAt &&
                      ` • Last sync: ${new Date(int.lastSyncAt).toLocaleString()}`}
                  </p>
                  {int.lastErrorMessage && (
                    <p className="text-sm text-red-600 mt-1">{int.lastErrorMessage}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      STATUS_STYLES[int.status] ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {STATUS_LABELS[int.status] ?? int.status.replace(/_/g, " ")}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDisconnect(int.id)}
                    disabled={loading === int.id}
                  >
                    {loading === int.id ? "Disconnecting…" : "Disconnect"}
                  </Button>
                </div>
              </div>
              <div>
                <button
                  type="button"
                  className="text-sm text-blue-600 hover:underline"
                  onClick={() => toggleFailures(int.id)}
                >
                  {expandedFailures === int.id ? "Hide" : "View"} failed syncs
                </button>
                {expandedFailures === int.id && (
                  <div className="mt-2 rounded border bg-muted/50 p-3 text-sm">
                    {(failures[int.id] ?? []).length === 0 ? (
                      <p className="text-muted-foreground">No failed syncs in the last 10.</p>
                    ) : (
                      <ul className="space-y-2">
                        {(failures[int.id] ?? []).map((f) => (
                          <li key={f.id} className="border-b pb-2 last:border-0">
                            <span className="text-muted-foreground">
                              {f.meetingId ? `Meeting ${f.meetingId.slice(0, 8)}…` : "N/A"} • {f.action} • {new Date(f.createdAt).toLocaleString()}
                            </span>
                            {f.errorMessage && (
                              <p className="text-red-600 mt-1">{f.errorMessage}</p>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
