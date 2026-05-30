"use client";

import { useState } from "react";
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
import { Textarea } from "~/components/ui/textarea";
import { getCategoryBySlug } from "~/lib/disclosure-categories";

type SuppressionEvidenceModalProps = {
  open: boolean;
  slug: string | null;
  onClose: () => void;
  onConfirm: (evidence: string) => Promise<void>;
};

export function SuppressionEvidenceModal({
  open,
  slug,
  onClose,
  onConfirm,
}: SuppressionEvidenceModalProps): React.JSX.Element {
  const [evidence, setEvidence] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const def = slug ? getCategoryBySlug(slug) : undefined;

  const handleConfirm = async (): Promise<void> => {
    const trimmed = evidence.trim();
    if (trimmed.length < 20) {
      setError("Evidence must be at least 20 characters.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onConfirm(trimmed);
      setEvidence("");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save — try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Suppression evidence required</DialogTitle>
          <DialogDescription>
            Document reference or rationale for suppressing{" "}
            <strong>{def?.displayName ?? slug}</strong>. Minimum 20 characters.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="suppression-evidence">Evidence</Label>
          <Textarea
            id="suppression-evidence"
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            rows={4}
            placeholder="e.g. ADV Part 2A, Item 5, p.8–10"
          />
          {error ? <p className="text-sm text-semantic-danger">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={saving} onClick={() => void handleConfirm()}>
            {saving ? "Saving…" : "Confirm suppression"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
