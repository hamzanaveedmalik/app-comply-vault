/**
 * CV-TR-02 — sealed pack bytes with seal metadata are deterministic.
 */

import { describe, expect, it, vi } from "vitest";
import { sha256FromBuffer } from "~/server/hash";
import { generateAuditPack } from "~/server/export";
import { SEAL_COVER_COPY } from "~/server/export/seal-metadata";
import { generateComplianceNotePDF } from "~/server/export/pdf";
import { buildExportPayload } from "~/server/export/export-payload";
import type { Meeting, Workspace } from "~/server/export/types";
import type { ExtractionData } from "~/server/extraction/types";

vi.mock("~/server/firm-profile/get-firm-profile-summary-for-export", () => ({
  getFirmProfileSummaryForExport: async () => ({ include: false }),
}));

const PACK_AT = new Date("2026-03-14T15:30:00.000Z");

const meeting = {
  id: "mtg_seal_cover",
  workspaceId: "ws_seal_cover",
  clientName: "Pat Lee",
  meetingType: "Annual Review",
  meetingDate: new Date("2026-03-10T18:00:00.000Z"),
  status: "CCO_SIGNED_OFF",
  fileUrl: null,
  sourceFileSha256: null,
  sourceFileName: null,
  sourceFileSize: null,
  sourceFileMime: "text/plain",
  sourceUploadedAt: new Date("2026-03-10T19:00:00.000Z"),
  transcript: null,
  extraction: null,
  finalizedBy: null,
  finalizedAt: null,
  finalizeReason: null,
  finalizeNote: null,
  finalizedPolicyVersion: null,
  samplingBucket: null,
  samplingRuleId: null,
  draftReadyAt: new Date("2026-03-10T20:00:00.000Z"),
  createdAt: new Date("2026-03-10T19:00:00.000Z"),
  updatedAt: new Date("2026-03-14T15:30:00.000Z"),
  ccoSignedOffAt: new Date("2026-03-13T10:00:00.000Z"),
} satisfies Meeting;

const workspace = {
  id: "ws_seal_cover",
  name: "Example Advisory LLC",
  retentionYears: 5,
  legalHold: false,
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  billingStatus: "ACTIVE",
  planTier: "TEAM",
  billingCurrency: "USD",
  pilotStartDate: null,
  trialStartedAt: null,
  trialEndsAt: null,
  subscriptionStartDate: null,
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  currentPeriodStart: null,
  currentPeriodEnd: null,
  onboardingType: null,
  onboardingPaidAt: null,
} satisfies Workspace;

const extraction: ExtractionData = {
  topics: [{ title: "Goals", description: "Retirement" }],
  recommendations: [],
  disclosures: [],
  decisions: [],
  followUps: [],
  evidenceMap: [],
  extractedAt: "2026-03-10T20:30:00.000Z",
  provider: "test",
  processingTime: 1,
};

const transcript = {
  segments: [
    { startTime: 0, endTime: 4, speaker: "Advisor", text: "Welcome." },
  ],
};

const seal = {
  sealId: "cseal_fixture_1",
  sealedAt: PACK_AT,
  expiresAt: new Date("2031-12-31T23:59:59.999Z"),
  packHash: "ab".repeat(32),
};

describe("CV-TR-02 sealed pack cover + determinism", () => {
  it("produces identical SHA-256 for the same seal metadata twice", async () => {
    const once = () =>
      generateAuditPack({
        meeting,
        extraction,
        transcript,
        versions: [],
        workspace,
        flags: [],
        watermarked: false,
        exportingUserName: "ComplyVault",
        packTimestamp: PACK_AT,
        seal,
        firmDisclosureProfile: {
          include: false,
          warning: null,
          versionReference: null,
          versionApprovedAt: null,
          approvingCcoName: null,
          suppressedCategories: [],
          statement: "",
        },
      });

    const a = await once();
    const b = await once();
    expect(sha256FromBuffer(a)).toBe(sha256FromBuffer(b));
  });

  it("embeds seal metadata in the export payload and renders a PDF", async () => {
    const payload = buildExportPayload(
      meeting,
      extraction,
      transcript,
      [],
      workspace,
      [],
      false,
      { packTimestamp: PACK_AT, seal },
    );
    expect(payload.seal?.sealId).toBe(seal.sealId);
    expect(payload.seal?.packHash).toBe(seal.packHash);
    expect(payload.seal?.coverCopy).toBe(SEAL_COVER_COPY);
    expect(payload.seal?.coverCopy).not.toMatch(/https?:\/\//i);
    expect(payload.seal?.coverCopy.toLowerCase()).not.toContain("verify at");

    const pdf = await generateComplianceNotePDF(payload);
    expect(pdf.length).toBeGreaterThan(1000);
    expect(pdf.subarray(0, 4).toString("ascii")).toBe("%PDF");
  });
});
