/**
 * CV-TR-02 — seal cover metadata; drafts carry no seal language.
 */

import { describe, expect, it } from "vitest";
import { buildExportPayload } from "~/server/export/export-payload";
import {
  SEAL_COVER_COPY,
  depositCustodyFooter,
} from "~/server/export/seal-metadata";
import type { Meeting, Workspace } from "~/server/export/types";
import type { ExtractionData } from "~/server/extraction/types";

const meeting = {
  id: "mtg_1",
  workspaceId: "ws_1",
  clientName: "Example Client",
  meetingType: "Annual Review",
  meetingDate: new Date("2026-03-14T15:00:00.000Z"),
  status: "CCO_SIGNED_OFF",
  fileUrl: null,
  sourceFileSha256: null,
  sourceFileName: null,
  sourceFileSize: null,
  sourceFileMime: null,
  sourceUploadedAt: null,
  transcript: null,
  extraction: null,
  finalizedBy: null,
  finalizedAt: null,
  finalizeReason: null,
  finalizeNote: null,
  finalizedPolicyVersion: null,
  samplingBucket: null,
  samplingRuleId: null,
  draftReadyAt: new Date("2026-03-14T14:00:00.000Z"),
  createdAt: new Date("2026-03-14T12:00:00.000Z"),
  updatedAt: new Date("2026-03-14T14:00:00.000Z"),
} satisfies Meeting;

const workspace = {
  id: "ws_1",
  name: "Example RIA",
  retentionYears: 5,
  fiscalYearEndMonth: 12,
  fiscalTimezone: "America/New_York",
  legalHold: false,
  createdAt: new Date("2020-01-01T00:00:00.000Z"),
  updatedAt: new Date("2020-01-01T00:00:00.000Z"),
  billingStatus: "ACTIVE",
  planTier: "GROWTH",
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
  topics: [],
  recommendations: [],
  disclosures: [],
  decisions: [],
  followUps: [],
  evidenceMap: [],
  extractedAt: "2026-03-14T14:30:00.000Z",
  provider: "test",
  processingTime: 1,
};

const transcript = {
  segments: [
    {
      startTime: 0,
      endTime: 5,
      speaker: "Advisor",
      text: "Hello",
    },
  ],
};

describe("CV-TR-02 seal cover payload", () => {
  it("omits seal fields on draft / non-finalised exports", () => {
    const payload = buildExportPayload(
      meeting,
      extraction,
      transcript,
      [],
      workspace,
      [],
      true,
      { packTimestamp: new Date("2026-03-14T15:30:00.000Z") },
    );
    expect(payload.seal).toBeUndefined();
    expect(payload.watermarked).toBe(true);
  });

  it("includes seal ID, full hash, timestamp, and Phase 1 cover copy", () => {
    const sealedAt = new Date("2026-03-14T16:00:00.000Z");
    const packHash = "a".repeat(64);
    const payload = buildExportPayload(
      meeting,
      extraction,
      transcript,
      [],
      workspace,
      [],
      false,
      {
        packTimestamp: sealedAt,
        seal: {
          sealId: "cseal123",
          sealedAt,
          packHash,
        },
      },
    );
    expect(payload.seal).toEqual({
      sealId: "cseal123",
      sealedAt: "2026-03-14T16:00:00.000Z",
      packHash,
      coverCopy: SEAL_COVER_COPY,
      custodyFooter: undefined,
    });
    expect(payload.seal?.coverCopy).not.toMatch(/https?:\/\//);
    expect(payload.seal?.coverCopy.toLowerCase()).not.toContain("verify at");
  });

  it("includes custody footer for deposit derivatives (CV-TR-18)", () => {
    const sealedAt = new Date("2026-03-14T16:00:00.000Z");
    const payload = buildExportPayload(
      meeting,
      extraction,
      transcript,
      [],
      workspace,
      [],
      false,
      {
        packTimestamp: sealedAt,
        seal: {
          sealId: "cseal123",
          sealedAt,
          packHash: "b".repeat(64),
          custodyFooter: depositCustodyFooter("cseal123"),
        },
      },
    );
    expect(payload.seal?.custodyFooter).toContain("cseal123");
    expect(payload.seal?.custodyFooter).toContain("system of record");
  });
});
