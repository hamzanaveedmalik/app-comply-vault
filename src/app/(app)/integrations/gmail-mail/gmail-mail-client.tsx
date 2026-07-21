"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { toast } from "sonner";
import type { MailboxConnectionDto } from "~/lib/types/evidence";
import type { GmailWorkspaceStatus } from "~/lib/types/evidence";

type MailFolder = { id: string; displayName: string };

export function GmailMailClient({
  workspaceStatus,
  connected,
  mailbox,
  error,
}: {
  workspaceStatus: GmailWorkspaceStatus;
  connected?: boolean;
  mailbox?: string;
  error?: string;
}) {
  const [connections, setConnections] = useState<MailboxConnectionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);
  const [folders, setFolders] = useState<MailFolder[]>([]);
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [backfillFrom, setBackfillFrom] = useState("");

  useEffect(() => {
    if (connected) toast.success("Mailbox connected");
    if (error) toast.error(error);
  }, [connected, error]);

  useEffect(() => {
    void loadConnections();
  }, []);

  async function loadConnections(): Promise<void> {
    setLoading(true);
    const res = await fetch("/api/mailbox/connections");
    const json = (await res.json()) as { success: boolean; data?: MailboxConnectionDto[] };
    if (json.success && json.data) {
      setConnections(json.data.filter((c) => c.provider === "GMAIL"));
    }
    setLoading(false);
  }

  async function loadFolders(connectionId: string): Promise<void> {
    setSelectedConnection(connectionId);
    const res = await fetch(`/api/mailbox/connections/${connectionId}/folders`);
    const json = (await res.json()) as { success: boolean; data?: MailFolder[]; error?: string };
    if (!json.success) {
      toast.error(json.error ?? "Could not load labels");
      return;
    }
    setFolders(json.data ?? []);
    const conn = connections.find((c) => c.id === connectionId);
    setSelectedFolders(conn?.scopeFolders ?? []);
    setBackfillFrom(conn?.backfillFrom?.slice(0, 10) ?? "");
  }

  async function saveScope(connectionId: string): Promise<void> {
    if (selectedFolders.length === 0) {
      toast.error("Select at least one label");
      return;
    }
    const res = await fetch(`/api/mailbox/connections/${connectionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scopeFolders: selectedFolders,
        backfillFrom: backfillFrom ? new Date(backfillFrom).toISOString() : undefined,
      }),
    });
    const json = (await res.json()) as { success: boolean; error?: string };
    if (!json.success) {
      toast.error(json.error ?? "Failed to save scope");
      return;
    }
    toast.success("Scope saved");
    await loadConnections();
  }

  async function startSync(connectionId: string, kind: "BACKFILL" | "DELTA"): Promise<void> {
    const res = await fetch(`/api/mailbox/connections/${connectionId}/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind }),
    });
    const json = (await res.json()) as { success: boolean; data?: { jobId: string }; error?: string };
    if (!json.success) {
      toast.error(json.error ?? "Sync failed");
      return;
    }
    toast.success(`${kind} job started`);
    await loadConnections();
  }

  function toggleFolder(folderId: string): void {
    setSelectedFolders((prev) =>
      prev.includes(folderId)
        ? prev.filter((id) => id !== folderId)
        : [...prev, folderId]
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#0D2818]">Gmail</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Controlled ingestion — selected mailbox, labels and date ranges only.
        </p>
      </div>

      {!workspaceStatus.oauthConfigured && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">Google OAuth not configured on the server</p>
          <p className="mt-1">
            Set <code className="text-xs">GMAIL_MAIL_CLIENT_ID</code> and{" "}
            <code className="text-xs">GMAIL_MAIL_CLIENT_SECRET</code> in Vercel (or{" "}
            <code className="text-xs">.env</code> locally). Enable the Gmail API and add the{" "}
            <code className="text-xs">gmail.readonly</code> scope on your Google Cloud OAuth app.
          </p>
        </div>
      )}

      {workspaceStatus.oauthConfigured && !workspaceStatus.connected && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">Gmail integration not connected</p>
          <p className="mt-1">
            Click <strong>Connect my mailbox</strong> below and sign in with Google to grant
            read-only access. Then select labels and run a backfill.
          </p>
        </div>
      )}

      {workspaceStatus.connected && (
        <p className="text-sm text-green-700">Workspace Gmail token active (delegated)</p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button asChild className="bg-[#2ECC71] text-[#0D2818] hover:bg-[#27ae60]">
          <a href="/api/integrations/gmail-mail/connect">Connect my mailbox</a>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/communications">View threads</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/mailbox/triage">Participant triage</Link>
        </Button>
      </div>

      {mailbox && (
        <p className="text-sm text-green-700">Connected mailbox: {decodeURIComponent(mailbox)}</p>
      )}

      <section className="space-y-4">
        <h2 className="font-medium">Connections</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : connections.length === 0 ? (
          <p className="text-sm text-muted-foreground">No mailboxes connected yet.</p>
        ) : (
          connections.map((c) => (
            <div key={c.id} className="rounded-lg border p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{c.mailboxAddress}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.status} · {c.consentMode} · last sync{" "}
                    {c.lastSyncAt ? new Date(c.lastSyncAt).toLocaleString() : "never"}
                  </p>
                  {c.lastErrorMessage && (
                    <p className="text-xs text-destructive">{c.lastErrorMessage}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => void loadFolders(c.id)}>
                    Labels
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => void startSync(c.id, "BACKFILL")}
                    className="bg-[#2ECC71] text-[#0D2818]"
                  >
                    Backfill
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => void startSync(c.id, "DELTA")}>
                    Delta sync
                  </Button>
                </div>
              </div>

              {selectedConnection === c.id && (
                <div className="space-y-3 border-t pt-3">
                  <Input
                    type="date"
                    value={backfillFrom}
                    onChange={(e) => setBackfillFrom(e.target.value)}
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    {folders.map((f) => (
                      <label key={f.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedFolders.includes(f.id)}
                          onChange={() => toggleFolder(f.id)}
                        />
                        {f.displayName}
                      </label>
                    ))}
                  </div>
                  <Button size="sm" onClick={() => void saveScope(c.id)}>
                    Save scope
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </section>
    </div>
  );
}
