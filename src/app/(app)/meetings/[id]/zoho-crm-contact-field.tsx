"use client";

import { useState } from "react";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { toast } from "~/lib/toast";

export function ZohoCrmContactField({
  meetingId,
  initialContactId,
  canEdit,
}: {
  meetingId: string;
  initialContactId: string | null;
  canEdit: boolean;
}) {
  const [value, setValue] = useState(initialContactId ?? "");
  const [saving, setSaving] = useState(false);

  if (!canEdit) {
    return null;
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Zoho CRM Contact ID (optional)</p>
      <p className="text-xs text-muted-foreground">
        If set, the auto-note is filed on this Contact. Otherwise we match a single Zoho contact whose
        Full Name equals the meeting client name.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="max-w-md"
          placeholder="Zoho record id"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <Button
          type="button"
          size="sm"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              const res = await fetch(`/api/meetings/${meetingId}/zoho-crm-contact`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  zohoCrmContactId: value.trim() === "" ? null : value.trim(),
                }),
              });
              if (!res.ok) {
                const j = (await res.json()) as { error?: string };
                throw new Error(j.error ?? "Save failed");
              }
              toast.success("Zoho contact link saved");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Save failed");
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
