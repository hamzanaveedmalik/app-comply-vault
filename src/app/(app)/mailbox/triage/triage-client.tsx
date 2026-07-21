"use client";

import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { toast } from "sonner";
import type { EmailTriageItemDto } from "~/lib/types/evidence";
import type { ClientListItemDto } from "~/lib/types/clients";

export function TriageClient() {
  const [items, setItems] = useState<EmailTriageItemDto[]>([]);
  const [clients, setClients] = useState<ClientListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmItem, setConfirmItem] = useState<EmailTriageItemDto | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load(): Promise<void> {
    setLoading(true);
    const [triageRes, clientsRes] = await Promise.all([
      fetch("/api/mailbox/triage"),
      fetch("/api/clients"),
    ]);
    const json = (await triageRes.json()) as { success: boolean; data?: EmailTriageItemDto[] };
    if (json.success && json.data) setItems(json.data);

    const clientsJson = (await clientsRes.json()) as {
      success: boolean;
      data?: ClientListItemDto[];
    };
    if (clientsJson.success && clientsJson.data) setClients(clientsJson.data);
    setLoading(false);
  }

  async function resolve(
    id: string,
    status: "CONFIRMED" | "EXTERNAL" | "IRRELEVANT",
    clientId?: string
  ): Promise<void> {
    setSubmitting(true);
    const res = await fetch(`/api/mailbox/triage/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        ...(clientId ? { clientId } : {}),
      }),
    });
    const json = (await res.json()) as {
      success: boolean;
      error?: string;
      data?: { threadsUpdated: number; evidenceAttached: number };
    };
    setSubmitting(false);
    if (!json.success) {
      toast.error(json.error ?? "Failed");
      return;
    }
    if (status === "CONFIRMED" && json.data) {
      toast.success(
        `Resolved. ${json.data.threadsUpdated} thread${json.data.threadsUpdated === 1 ? "" : "s"} updated; ${json.data.evidenceAttached} message${json.data.evidenceAttached === 1 ? "" : "s"} attached.`
      );
    } else {
      toast.success("Resolved");
    }
    setConfirmItem(null);
    setSelectedClientId("");
    await load();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold text-[#0D2818]">Participant triage</h1>
      <p className="text-sm text-muted-foreground">
        Unmatched email addresses from ingested threads.
      </p>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pending addresses.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div className="space-y-0.5">
                <span className="font-mono text-sm">{item.address}</span>
                {item.historicalThreadCount > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {item.historicalThreadCount} historical thread
                    {item.historicalThreadCount === 1 ? "" : "s"} will be attached on confirm
                  </p>
                ) : null}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => void resolve(item.id, "EXTERNAL")}>
                  External
                </Button>
                <Button size="sm" variant="secondary" onClick={() => void resolve(item.id, "IRRELEVANT")}>
                  Irrelevant
                </Button>
                <Button
                  size="sm"
                  className="bg-[#2ECC71] text-[#0D2818]"
                  onClick={() => {
                    setSelectedClientId("");
                    setConfirmItem(item);
                  }}
                >
                  Confirm
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={confirmItem != null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmItem(null);
            setSelectedClientId("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link address to client</DialogTitle>
            <DialogDescription>
              {confirmItem
                ? `${confirmItem.historicalThreadCount} historical thread${confirmItem.historicalThreadCount === 1 ? "" : "s"} will be attached to the selected client.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="triage-client">Client</Label>
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger id="triage-client">
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {clients.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No clients in this workspace yet. Create a client record before confirming.
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConfirmItem(null);
                setSelectedClientId("");
              }}
            >
              Cancel
            </Button>
            <Button
              className="bg-[#2ECC71] text-[#0D2818]"
              disabled={!selectedClientId || submitting || !confirmItem}
              onClick={() => {
                if (!confirmItem || !selectedClientId) return;
                void resolve(confirmItem.id, "CONFIRMED", selectedClientId);
              }}
            >
              Confirm and attach
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
