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
import type { DisclosureCategoryDto } from "~/lib/firm-profile-types";

type ApproveProfileModalProps = {
  open: boolean;
  categories: DisclosureCategoryDto[];
  onClose: () => void;
  onConfirm: () => Promise<void>;
};

export function ApproveProfileModal({
  open,
  categories,
  onClose,
  onConfirm,
}: ApproveProfileModalProps): React.JSX.Element {
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const suppressing = categories.filter((c) => c.status === "SUPPRESSING");
  const active = categories.filter((c) => c.status === "ACTIVE" && !c.neverSuppress);
  const locked = categories.filter((c) => c.status === "NEVER_SUPPRESS" || c.neverSuppress);

  const handleConfirm = async (): Promise<void> => {
    if (!confirmed) return;
    setSaving(true);
    setError(null);
    try {
      await onConfirm();
      setConfirmed(false);
      onClose();
    } catch {
      setError("Approval failed. Changes not committed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Approve disclosure profile</DialogTitle>
          <DialogDescription>
            {suppressing.length} suppressed · {active.length} active · {locked.length} locked
          </DialogDescription>
        </DialogHeader>
        {suppressing.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {suppressing.map((c) => (
              <li key={c.slug} className="rounded border border-surface-border p-2">
                <div className="font-medium">{c.displayName}</div>
                <div className="text-xs text-text-muted">{c.suppressionEvidence}</div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-muted">No categories are currently suppressed.</p>
        )}
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-1"
          />
          <span>
            I confirm this disclosure profile reflects the firm&apos;s current ADV and compliance
            documentation.
          </span>
        </label>
        {error ? <p className="text-sm text-semantic-danger">{error}</p> : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!confirmed || saving}
            className="bg-brand-dark text-white"
            onClick={() => void handleConfirm()}
          >
            {saving ? "Approving…" : "Approve"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
