/**
 * CV-TR-19 — sealed packs are never watermarked.
 */

import { describe, expect, it } from "vitest";
import { resolveExportWatermark } from "./watermark";
import { sha256FromBuffer } from "~/server/hash";
import { generateAuditPack } from "./index";
import type { Meeting, Version, Workspace } from "./types";
import type { ExtractionData } from "../extraction/types";
import type { TranscriptSegment } from "../transcription/types";

const PACK_AT = new Date("2026-03-14T15:30:00.000Z");
const MEETING_DATE = new Date("2026-03-10T18:00:00.000Z");

describe("resolveExportWatermark", () => {
  const trialWorkspace = {
    billingStatus: "TRIALING" as const,
    planTier: "FREE" as const,
    trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  };

  const paidWorkspace = {
    billingStatus: "ACTIVE" as const,
    planTier: "TEAM" as const,
    trialEndsAt: null,
  };

  it("watermarks draft exports under a trialing entitlement", () => {
    expect(
      resolveExportWatermark({ purpose: "draft", workspace: trialWorkspace }),
    ).toBe(true);
  });

  it("does not watermark draft exports for paid workspaces", () => {
    expect(
      resolveExportWatermark({ purpose: "draft", workspace: paidWorkspace }),
    ).toBe(false);
  });

  it("never watermarks sealed packs regardless of entitlement", () => {
    expect(
      resolveExportWatermark({ purpose: "seal", workspace: trialWorkspace }),
    ).toBe(false);
    expect(
      resolveExportWatermark({ purpose: "seal", workspace: paidWorkspace }),
    ).toBe(false);
  });
});

describe("CV-TR-19 sealed pack hash stability across entitlements", () => {
  function fixtureMeeting(): Meeting {
    return {
      id: "mtg_seal_1",
      workspaceId: "ws_seal_1",
      clientName: "Alex Rivera",
      meetingType: "Annual Review",
      meetingDate: MEETING_DATE,
      status: "FINALIZED",
      fileUrl: null,
      sourceFileSha256: null,
      sourceFileName: null,
      sourceFileSize: null,
      sourceFileMime: null,
      sourceUploadedAt: null,
      transcript: null,
      extraction: null,
      finalizedBy: "user_cco",
      finalizedAt: PACK_AT,
      finalizeReason: "COMPLETE_REVIEW",
      finalizeNote: null,
      finalizedPolicyVersion: 1,
      samplingBucket: null,
      samplingRuleId: null,
      draftReadyAt: MEETING_DATE,
      createdAt: MEETING_DATE,
      updatedAt: PACK_AT,
    };
  }

  function fixtureWorkspace(overrides?: Partial<Workspace>): Workspace {
    return {
      id: "ws_seal_1",
      name: "Rivera Advisors",
      retentionYears: 5,
      legalHold: false,
      createdAt: MEETING_DATE,
      updatedAt: MEETING_DATE,
      billingStatus: "TRIALING",
      planTier: "FREE",
      billingCurrency: "USD",
      pilotStartDate: null,
      trialStartedAt: MEETING_DATE,
      trialEndsAt: new Date("2099-01-01T00:00:00.000Z"),
      subscriptionStartDate: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      onboardingType: null,
      onboardingPaidAt: null,
      ...overrides,
    };
  }

  function fixtureExtraction(): ExtractionData {
    return {
      topics: [{ title: "Fees", description: "Discussed fees" }],
      recommendations: [],
      disclosures: [],
      decisions: [],
      followUps: [],
      evidenceMap: [
        {
          field: "disclosure",
          claim: "Fees",
          startTime: 0,
          endTime: 10,
          snippet: "as disclosed",
          confidence: 0.9,
          edited: false,
        },
      ],
      extractedAt: "2026-03-10T20:05:00.000Z",
      provider: "openai",
      processingTime: 100,
    };
  }

  function fixtureSegments(): TranscriptSegment[] {
    return [
      { startTime: 0, endTime: 10, speaker: "Advisor", text: "as disclosed" },
    ];
  }

  function fixtureVersions(): Version[] {
    return [
      {
        id: "ver_1",
        meetingId: "mtg_seal_1",
        version: 1,
        editorId: "user_system",
        whatChanged: "Initial draft",
        reason: null,
        timestamp: MEETING_DATE,
      },
    ];
  }

  const emptyFirmProfile = {
    include: false,
    warning: null,
    versionReference: null,
    versionApprovedAt: null,
    approvingCcoName: null,
    suppressedCategories: [] as Array<{
      slug: string;
      displayName: string;
      evidence: string;
    }>,
    statement:
      "The following disclosure categories are suppressed at the firm level and are not flagged in individual meeting reviews.",
  };

  async function packOnce(args: {
    workspace: Workspace;
    watermarked: boolean;
  }): Promise<Buffer> {
    const { finalizedBy: _id, ...rest } = fixtureMeeting();
    const meetingForExport = {
      ...rest,
      finalizedBy: {
        id: "user_cco",
        name: "Casey Owner",
        email: "casey@example.com",
        emailVerified: null,
        image: null,
      },
    } as Meeting & { finalizedBy?: import("./types").User | null };

    return generateAuditPack({
      meeting: meetingForExport,
      extraction: fixtureExtraction(),
      transcript: { segments: fixtureSegments() },
      versions: fixtureVersions(),
      workspace: args.workspace,
      flags: [],
      watermarked: args.watermarked,
      exportingUserName: "Casey Owner",
      packTimestamp: PACK_AT,
      firmDisclosureProfile: emptyFirmProfile,
      supersessionChainText: null,
    });
  }

  it("produces identical sealed SHA-256 under trial and paid entitlements", async () => {
    const trialWs = fixtureWorkspace({ billingStatus: "TRIALING", planTier: "FREE" });
    const paidWs = fixtureWorkspace({
      billingStatus: "ACTIVE",
      planTier: "TEAM",
      trialEndsAt: null,
    });

    // Resolve as seal purpose would — both must force watermark off.
    expect(
      resolveExportWatermark({
        purpose: "seal",
        workspace: {
          billingStatus: "TRIALING",
          planTier: "FREE",
          trialEndsAt: trialWs.trialEndsAt,
        },
      }),
    ).toBe(false);
    expect(
      resolveExportWatermark({
        purpose: "seal",
        workspace: {
          billingStatus: "ACTIVE",
          planTier: "TEAM",
          trialEndsAt: null,
        },
      }),
    ).toBe(false);

    const trialHash = sha256FromBuffer(
      await packOnce({ workspace: trialWs, watermarked: false }),
    );
    const paidHash = sha256FromBuffer(
      await packOnce({ workspace: paidWs, watermarked: false }),
    );
    expect(trialHash).toBe(paidHash);
  }, 15_000);

  it("draft watermark changes the hash (proves seal path is the special case)", async () => {
    const workspace = fixtureWorkspace();
    const sealed = await packOnce({ workspace, watermarked: false });
    const draft = await packOnce({ workspace, watermarked: true });
    expect(sha256FromBuffer(sealed)).not.toBe(sha256FromBuffer(draft));
  }, 15_000);
});
