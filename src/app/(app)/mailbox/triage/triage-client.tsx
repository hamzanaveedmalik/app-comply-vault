"use client";

import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { toast } from "sonner";
import type { EmailTriageItemDto } from "~/lib/types/evidence";

export function TriageClient() {
  const [items, setItems] = useState<EmailTriageItemDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, []);

  async function load(): Promise<void> {
    setLoading(true);
    const res = await fetch("/api/mailbox/triage");
    const json = (await res.json()) as { success: boolean; data?: EmailTriageItemDto[] };
    if (json.success && json.data) setItems(json.data);
    setLoading(false);
  }

  async function resolve(
    id: string,
    status: "CONFIRMED" | "EXTERNAL" | "IRRELEVANT"
  ): Promise<void> {
    const res = await fetch(`/api/mailbox/triage/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const json = (await res.json()) as { success: boolean; error?: string };
    if (!json.success) {
      toast.error(json.error ?? "Failed");
      return;
    }
    toast.success("Resolved");
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
              <span className="font-mono text-sm">{item.address}</span>
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
                  onClick={() => void resolve(item.id, "CONFIRMED")}
                >
                  Confirm
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
