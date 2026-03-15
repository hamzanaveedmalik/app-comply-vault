"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import { CheckCircle2, AlertCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

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
  accountEmail?: string | null;
  recordingScope?: string;
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
  zoomConnected,
  zoomEmail,
  zoomError,
  zoomErrorDescription,
  teamsConnected,
  teamsEmail,
  teamsError,
  teamsErrorDescription,
}: {
  workspaceId: string;
  initialIntegrations: Integration[];
  zoomConnected?: boolean;
  zoomEmail?: string | null;
  zoomError?: string | null;
  zoomErrorDescription?: string | null;
  teamsConnected?: boolean;
  teamsEmail?: string | null;
  teamsError?: string | null;
  teamsErrorDescription?: string | null;
}) {
  const [integrations, setIntegrations] = useState(initialIntegrations);
  const [expandedFailures, setExpandedFailures] = useState<string | null>(null);
  const [failures, setFailures] = useState<Record<string, Failure[]>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [connectLoading, setConnectLoading] = useState(false);
  const router = useRouter();

  const hasZoom = integrations.some((i) => i.provider === "ZOOM");
  const hasTeams = integrations.some((i) => i.provider === "TEAMS");

  useEffect(() => {
    if (
      (zoomConnected && zoomEmail && integrations.some((i) => i.provider === "ZOOM")) ||
      (teamsConnected && teamsEmail && integrations.some((i) => i.provider === "TEAMS"))
    ) {
      window.history.replaceState({}, "", "/integrations");
    }
  }, [zoomConnected, zoomEmail, teamsConnected, teamsEmail, integrations]);

  function handleConnectZoom() {
    setConnectLoading(true);
    window.location.href = "/api/integrations/zoom/connect";
  }

  function handleConnectTeams() {
    setConnectLoading(true);
    window.location.href = "/api/integrations/teams/connect";
  }

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

      {zoomConnected && zoomEmail && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-green-800">Zoom connected successfully</p>
            <p className="text-sm text-green-700 mt-1">
              Your Zoom account ({zoomEmail}) is now connected. Meeting recordings will automatically sync to ComplyVault.
            </p>
          </div>
        </div>
      )}

      {teamsConnected && teamsEmail && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-green-800">Microsoft Teams connected successfully</p>
            <p className="text-sm text-green-700 mt-1">
              Your Teams account ({teamsEmail}) is now connected. Meeting recordings will automatically sync to ComplyVault.
            </p>
          </div>
        </div>
      )}

      {teamsError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-800">Teams connection failed</p>
            <p className="text-sm text-red-700 mt-1">
              {teamsErrorDescription ?? "Please try again."}
            </p>
          </div>
        </div>
      )}

      {zoomError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-800">Zoom connection failed</p>
            <p className="text-sm text-red-700 mt-1">
              {zoomErrorDescription || zoomError === "access_denied"
                ? "You denied access or cancelled the connection."
                : zoomError === "invalid_callback"
                  ? "Invalid or expired connection request. Please try again."
                  : zoomErrorDescription ?? "Please try again."}
            </p>
          </div>
        </div>
      )}

      {integrations.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No integrations connected yet.</p>
          <p className="text-sm text-muted-foreground mt-2 mb-6">
            Integration connections (Zoom, Teams, SharePoint, etc.) will appear here once configured.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button onClick={handleConnectZoom} disabled={connectLoading} size="lg">
              {connectLoading ? "Redirecting…" : "Connect Zoom"}
            </Button>
            <Button onClick={handleConnectTeams} disabled={connectLoading} variant="outline" size="lg">
              Connect Teams
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {!hasZoom && (
            <div className="rounded-lg border p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">Zoom</p>
                <p className="text-sm text-muted-foreground">
                  Auto-sync meeting recordings to ComplyVault
                </p>
              </div>
              <Button onClick={handleConnectZoom} disabled={connectLoading}>
                {connectLoading ? "Redirecting…" : "Connect"}
              </Button>
            </div>
          )}
          {!hasTeams && (
            <div className="rounded-lg border p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">Microsoft Teams</p>
                <p className="text-sm text-muted-foreground">
                  Auto-sync Teams meeting recordings to ComplyVault
                </p>
              </div>
              <Button onClick={handleConnectTeams} disabled={connectLoading} variant="outline">
                Connect
              </Button>
            </div>
          )}
          {integrations.map((int) => (
            <div key={int.id} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {PROVIDER_LABELS[int.provider] ?? int.provider}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {int.accountEmail ? `${int.accountEmail} • ` : ""}
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
              {int.provider === "ZOOM" && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Recording scope:</span>
                  <Select
                    value={int.recordingScope ?? "all"}
                    onValueChange={async (v) => {
                      const res = await fetch(
                        `/api/workspaces/${workspaceId}/integrations/zoom/scope`,
                        {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ recordingScope: v }),
                        }
                      );
                      if (res.ok) router.refresh();
                    }}
                  >
                    <SelectTrigger className="w-[220px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All meetings</SelectItem>
                      <SelectItem value="external_only">
                        External participants only
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
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
