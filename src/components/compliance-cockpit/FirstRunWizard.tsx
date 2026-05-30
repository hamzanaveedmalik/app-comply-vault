"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { DisclosureGrid } from "./DisclosureGrid";
import { SuppressionEvidenceModal } from "./SuppressionEvidenceModal";
import type { DisclosureCategoryDto } from "~/lib/firm-profile-types";
import { DISCLOSURE_CATEGORY_CATALOG } from "~/lib/disclosure-categories";

type FirstRunWizardProps = {
  workspaceId: string;
  initialDraft?: {
    crdNumber?: string | null;
    ccoName?: string | null;
    advFilingDate?: string | null;
    aumUsd?: string | null;
    advDocumentUrl?: string | null;
    riskFlags?: string[];
  };
  onComplete: () => void;
};

function buildDefaultCategories(): DisclosureCategoryDto[] {
  return DISCLOSURE_CATEGORY_CATALOG.map((def) => ({
    slug: def.slug,
    displayName: def.displayName,
    section: def.section,
    neverSuppress: def.neverSuppress,
    status: def.neverSuppress ? "NEVER_SUPPRESS" : "ACTIVE",
    suppressionEvidence: null,
    advItemRef: null,
    advPage: null,
    description: def.description,
  }));
}

export function FirstRunWizard({
  workspaceId,
  initialDraft,
  onComplete,
}: FirstRunWizardProps): React.JSX.Element {
  const [step, setStep] = useState<1 | 2>(
    initialDraft?.ccoName || initialDraft?.crdNumber ? 2 : 1,
  );
  const [crdNumber, setCrdNumber] = useState(initialDraft?.crdNumber ?? "");
  const [ccoName, setCcoName] = useState(initialDraft?.ccoName ?? "");
  const [advFilingDate, setAdvFilingDate] = useState(
    initialDraft?.advFilingDate?.slice(0, 10) ?? "",
  );
  const [aumUsd, setAumUsd] = useState(initialDraft?.aumUsd ?? "");
  const [advDocumentUrl, setAdvDocumentUrl] = useState(initialDraft?.advDocumentUrl ?? "");
  const [riskFlagsText, setRiskFlagsText] = useState(
    (initialDraft?.riskFlags ?? []).join(", "),
  );
  const [categories, setCategories] = useState<DisclosureCategoryDto[]>(buildDefaultCategories);
  const [neverSuppressAck, setNeverSuppressAck] = useState(false);
  const [evidenceSlug, setEvidenceSlug] = useState<string | null>(null);
  const [pendingToggles, setPendingToggles] = useState<
    Array<{ slug: string; status: "SUPPRESSING"; suppressionEvidence: string }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const saveStep1 = async (): Promise<void> => {
    setSaving(true);
    setError(null);
    const riskFlags = riskFlagsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const res = await fetch(`/api/workspaces/${workspaceId}/firm-profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "DRAFT",
        crdNumber: crdNumber || undefined,
        ccoName: ccoName || undefined,
        advFilingDate: advFilingDate ? new Date(advFilingDate).toISOString() : undefined,
        aumUsd: aumUsd || undefined,
        advDocumentUrl: advDocumentUrl || undefined,
        riskFlags,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Could not save firm details.");
      return;
    }
    setStep(2);
  };

  const handleToggleRequest = (slug: string): void => {
    const cat = categories.find((c) => c.slug === slug);
    if (!cat || cat.neverSuppress) return;
    if (cat.status === "SUPPRESSING") {
      setCategories((prev) =>
        prev.map((c) =>
          c.slug === slug ? { ...c, status: "ACTIVE", suppressionEvidence: null } : c,
        ),
      );
      setPendingToggles((prev) => prev.filter((t) => t.slug !== slug));
      return;
    }
    setEvidenceSlug(slug);
  };

  const handleEvidenceConfirm = async (evidence: string): Promise<void> => {
    if (!evidenceSlug) return;
    setCategories((prev) =>
      prev.map((c) =>
        c.slug === evidenceSlug
          ? { ...c, status: "SUPPRESSING", suppressionEvidence: evidence }
          : c,
      ),
    );
    setPendingToggles((prev) => [
      ...prev.filter((t) => t.slug !== evidenceSlug),
      { slug: evidenceSlug, status: "SUPPRESSING", suppressionEvidence: evidence },
    ]);
    setEvidenceSlug(null);
  };

  const completeWizard = async (): Promise<void> => {
    if (!neverSuppressAck) {
      setError("Please acknowledge never-suppress requirements.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/workspaces/${workspaceId}/firm-profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        neverSuppressAcknowledged: true,
        categoryToggles: pendingToggles,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Could not complete setup.");
      return;
    }
    onComplete();
  };

  if (step === 1) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-6">
        <h1 className="text-lg font-semibold text-text-primary">Firm disclosure profile setup</h1>
        <p className="text-sm text-text-secondary">Step 1 — Firm details</p>
        <div className="space-y-3">
          <div>
            <Label htmlFor="crd">CRD number</Label>
            <Input id="crd" value={crdNumber} onChange={(e) => setCrdNumber(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="cco">CCO name</Label>
            <Input id="cco" value={ccoName} onChange={(e) => setCcoName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="adv-date">ADV filing date</Label>
            <Input
              id="adv-date"
              type="date"
              value={advFilingDate}
              onChange={(e) => setAdvFilingDate(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="aum">AUM (USD)</Label>
            <Input id="aum" value={aumUsd} onChange={(e) => setAumUsd(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="adv-url">ADV Part 2A URL (optional)</Label>
            <Input
              id="adv-url"
              value={advDocumentUrl}
              onChange={(e) => setAdvDocumentUrl(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="risk">Risk flags (comma-separated)</Label>
            <Input
              id="risk"
              value={riskFlagsText}
              onChange={(e) => setRiskFlagsText(e.target.value)}
              placeholder="Dual-Hat Advisors, Regulatory History"
            />
          </div>
        </div>
        {error ? <p className="text-sm text-semantic-danger">{error}</p> : null}
        <Button type="button" disabled={saving} onClick={() => void saveStep1()}>
          Continue
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-1 text-lg font-semibold text-text-primary">Review disclosure categories</h1>
      <p className="mb-4 text-sm text-text-secondary">Step 2 — Toggle suppressible items as needed.</p>
      <DisclosureGrid
        categories={categories}
        canWrite
        onToggleRequest={handleToggleRequest}
      />
      <label className="mt-6 flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={neverSuppressAck}
          onChange={(e) => setNeverSuppressAck(e.target.checked)}
          className="mt-1"
        />
        <span>
          I understand Conflicts of Interest, Insurance Comp., and Disciplinary History require
          verbal disclosure in every client meeting.
        </span>
      </label>
      {error ? <p className="mt-2 text-sm text-semantic-danger">{error}</p> : null}
      <div className="mt-4 flex gap-2">
        <Button type="button" variant="outline" onClick={() => setStep(1)}>
          Back
        </Button>
        <Button type="button" disabled={saving} onClick={() => void completeWizard()}>
          Complete setup
        </Button>
      </div>
      <SuppressionEvidenceModal
        open={evidenceSlug != null}
        slug={evidenceSlug}
        onClose={() => setEvidenceSlug(null)}
        onConfirm={handleEvidenceConfirm}
      />
    </div>
  );
}
