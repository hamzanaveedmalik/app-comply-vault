/**
 * CV-TR-02a — Deterministic audit pack bytes.
 *
 * Same record state must produce identical SHA-256 across:
 * - repeated generation
 * - different calendar days (fake timers)
 * - different TZ / locale environments
 */

import { inflateRawSync } from "zlib";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sha256FromBuffer } from "~/server/hash";
import { generateAuditPack } from "./index";
import { buildExportPayload } from "./export-payload";
import { canonicalTranscriptText } from "./txt";
import {
  ZIP_ENTRY_EPOCH,
  canonicalJson,
  formatUtcIso,
  resolvePackTimestamp,
  sortByStartTimeThenClaim,
  sortFlags,
} from "./deterministic";
import type { Meeting, Version, Workspace } from "./types";
import type { ExtractionData } from "../extraction/types";
import type { TranscriptSegment } from "../transcription/types";

const PACK_AT = new Date("2026-03-14T15:30:00.000Z");
const MEETING_DATE = new Date("2026-03-10T18:00:00.000Z");

function fixtureMeeting(overrides?: Partial<Meeting>): Meeting {
  return {
    id: "mtg_fixture_1",
    workspaceId: "ws_fixture_1",
    clientName: "Alex Rivera",
    meetingType: "Annual Review",
    meetingDate: MEETING_DATE,
    status: "FINALIZED",
    fileUrl: "workspaces/ws_fixture_1/meetings/mtg_fixture_1/recording.mp4",
    sourceFileSha256: "abc123",
    sourceFileName: "recording.mp4",
    sourceFileSize: 1024,
    sourceFileMime: "video/mp4",
    sourceUploadedAt: new Date("2026-03-10T19:00:00.000Z"),
    transcript: null,
    extraction: null,
    finalizedBy: "user_cco",
    finalizedAt: PACK_AT,
    finalizeReason: "COMPLETE_REVIEW",
    finalizeNote: null,
    finalizedPolicyVersion: 1,
    samplingBucket: null,
    samplingRuleId: null,
    draftReadyAt: new Date("2026-03-10T20:00:00.000Z"),
    createdAt: new Date("2026-03-10T19:00:00.000Z"),
    updatedAt: new Date("2026-03-14T15:30:00.000Z"),
    advisorCertifiedAt: new Date("2026-03-11T10:00:00.000Z"),
    cmReviewedAt: new Date("2026-03-12T10:00:00.000Z"),
    ccoSignedOffAt: new Date("2026-03-13T10:00:00.000Z"),
    ...overrides,
  };
}

function fixtureWorkspace(): Workspace {
  return {
    id: "ws_fixture_1",
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
  };
}

function fixtureExtraction(): ExtractionData {
  return {
    topics: [
      { title: "Portfolio review", description: "Reviewed allocation" },
      { title: "Risk tolerance", description: "Confirmed moderate" },
    ],
    recommendations: [
      {
        text: "Rebalance toward equity target",
        startTime: 120,
        endTime: 150,
        snippet: "we should rebalance",
        confidence: 0.91,
      },
    ],
    disclosures: [
      {
        text: "Fee schedule discussed",
        startTime: 30,
        endTime: 45,
        snippet: "as disclosed in Form ADV",
        confidence: 0.88,
      },
    ],
    decisions: [],
    followUps: [
      {
        text: "Send updated IPS",
        startTime: 200,
        endTime: 220,
        snippet: "I will send the IPS",
        confidence: 0.8,
      },
    ],
    // Deliberately unsorted — pack must sort stably
    evidenceMap: [
      {
        field: "recommendation",
        claim: "Rebalance toward equity target",
        startTime: 120,
        endTime: 150,
        snippet: "we should rebalance",
        confidence: 0.91,
        edited: false,
      },
      {
        field: "disclosure",
        claim: "Fee schedule discussed",
        startTime: 30,
        endTime: 45,
        snippet: "as disclosed in Form ADV",
        confidence: 0.88,
        edited: false,
      },
    ],
    extractedAt: "2026-03-10T20:05:00.000Z",
    provider: "openai",
    processingTime: 1200,
  };
}

function fixtureSegments(): TranscriptSegment[] {
  return [
    {
      startTime: 30,
      endTime: 45,
      speaker: "Advisor",
      text: "as disclosed in Form ADV",
    },
    {
      startTime: 120,
      endTime: 150,
      speaker: "Advisor",
      text: "we should rebalance",
    },
    {
      startTime: 200,
      endTime: 220,
      speaker: "Advisor",
      text: "I will send the IPS",
    },
  ];
}

function fixtureVersions(): Version[] {
  return [
    {
      id: "ver_2",
      meetingId: "mtg_fixture_1",
      version: 2,
      editorId: "user_cm",
      whatChanged: "Updated disclosure wording",
      reason: "Clarity",
      timestamp: new Date("2026-03-12T11:00:00.000Z"),
    },
    {
      id: "ver_1",
      meetingId: "mtg_fixture_1",
      version: 1,
      editorId: "user_system",
      whatChanged: "Initial draft",
      reason: null,
      timestamp: new Date("2026-03-10T20:05:00.000Z"),
    },
  ];
}

const emptyFirmProfile = {
  include: false,
  warning: null,
  versionReference: null,
  versionApprovedAt: null,
  approvingCcoName: null,
  suppressedCategories: [],
  statement:
    "The following disclosure categories are suppressed at the firm level and are not flagged in individual meeting reviews.",
};

async function packOnce(): Promise<Buffer> {
  const { finalizedBy: _finalizedById, ...meeting } = fixtureMeeting();
  const meetingForExport = {
    ...meeting,
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
    workspace: fixtureWorkspace(),
    flags: [
      {
        type: "MISSING_DISCLOSURE",
        severity: "WARN",
        status: "RESOLVED",
        evidence: "fee discussion",
      },
      {
        type: "CONFLICT_LANGUAGE",
        severity: "INFO",
        status: "DISMISSED",
      },
    ],
    watermarked: false,
    exportingUserName: "Casey Owner",
    packTimestamp: PACK_AT,
    firmDisclosureProfile: emptyFirmProfile,
  });
}

describe("CV-TR-02a deterministic helpers", () => {
  it("formats UTC ISO without locale drift", () => {
    expect(formatUtcIso(PACK_AT)).toBe("2026-03-14T15:30:00.000Z");
  });

  it("resolves pack timestamp without wall clock", () => {
    const meeting = fixtureMeeting({ finalizedAt: null });
    const resolved = resolvePackTimestamp({
      packTimestamp: PACK_AT,
      finalizedAt: meeting.finalizedAt,
      createdAt: meeting.createdAt,
    });
    expect(resolved.toISOString()).toBe(PACK_AT.toISOString());
  });

  it("sorts evidence and flags stably", () => {
    const evidence = sortByStartTimeThenClaim(fixtureExtraction().evidenceMap);
    expect(evidence[0]?.startTime).toBe(30);
    expect(evidence[1]?.startTime).toBe(120);

    const flags = sortFlags([
      { type: "Z", severity: "INFO", status: "OPEN" },
      { type: "A", severity: "WARN", status: "OPEN" },
      { type: "A", severity: "INFO", status: "OPEN" },
    ]);
    expect(flags.map((f) => `${f.type}:${f.severity}`)).toEqual([
      "A:INFO",
      "A:WARN",
      "Z:INFO",
    ]);
  });

  it("canonicalJson sorts object keys", () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it("ZIP_ENTRY_EPOCH is 1980-01-01 UTC", () => {
    expect(ZIP_ENTRY_EPOCH.toISOString()).toBe("1980-01-01T00:00:00.000Z");
  });
});

describe("CV-TR-02a buildExportPayload", () => {
  it("never embeds wall-clock timestamps", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2099-01-01T00:00:00.000Z"));

    const { finalizedBy: _finalizedById, ...meeting } = fixtureMeeting();
    const meetingForExport = {
      ...meeting,
      finalizedBy: {
        id: "user_cco",
        name: "Casey Owner",
        email: "casey@example.com",
        emailVerified: null,
        image: null,
      },
    } as Meeting & { finalizedBy?: import("./types").User | null };

    const payload = buildExportPayload(
      meetingForExport,
      fixtureExtraction(),
      { segments: fixtureSegments() },
      fixtureVersions(),
      fixtureWorkspace(),
      [{ type: "MISSING_DISCLOSURE", severity: "WARN", status: "RESOLVED" }],
      false,
      { exportingUserName: "Casey Owner", packTimestamp: PACK_AT },
    );

    expect(payload.pack_timestamp).toBe("2026-03-14T15:30:00.000Z");
    expect(JSON.stringify(payload)).not.toContain("2099");
    for (const row of payload.audit_trail) {
      if (row.timestamp !== "Pending") {
        expect(row.timestamp.endsWith("Z") || row.timestamp.includes("T")).toBe(true);
        expect(row.timestamp).not.toMatch(/[AP]M/);
      }
    }

    vi.useRealTimers();
  });
});

describe("CV-TR-02a generateAuditPack hash stability", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("produces identical SHA-256 on two consecutive generations", async () => {
    const a = await packOnce();
    const b = await packOnce();
    expect(sha256FromBuffer(a)).toBe(sha256FromBuffer(b));
  });

  it("produces identical SHA-256 on different calendar days", async () => {
    // Fake only Date so archiver/PDFKit async I/O still advances.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-03-14T12:00:00.000Z"));
    const day1 = sha256FromBuffer(await packOnce());

    vi.setSystemTime(new Date("2026-07-26T23:59:59.000Z"));
    const day2 = sha256FromBuffer(await packOnce());

    expect(day1).toBe(day2);
  }, 15_000);

  it("produces identical SHA-256 under UTC and Pacific/Auckland process TZ", async () => {
    const prevTz = process.env.TZ;
    const prevLang = process.env.LANG;
    const prevLc = process.env.LC_ALL;

    try {
      process.env.TZ = "UTC";
      process.env.LANG = "en_US.UTF-8";
      process.env.LC_ALL = "en_US.UTF-8";
      const utcHash = sha256FromBuffer(await packOnce());

      process.env.TZ = "Pacific/Auckland";
      process.env.LANG = "en_NZ.UTF-8";
      process.env.LC_ALL = "en_NZ.UTF-8";
      const aucklandHash = sha256FromBuffer(await packOnce());

      expect(utcHash).toBe(aucklandHash);
    } finally {
      if (prevTz === undefined) delete process.env.TZ;
      else process.env.TZ = prevTz;
      if (prevLang === undefined) delete process.env.LANG;
      else process.env.LANG = prevLang;
      if (prevLc === undefined) delete process.env.LC_ALL;
      else process.env.LC_ALL = prevLc;
    }
  });
});

/** Extract one entry's bytes from a ZIP buffer via the central directory. */
function readZipEntry(zip: Buffer, entryName: string): Buffer {
  // End of central directory record (no ZIP comment in our packs).
  let eocd = -1;
  for (let i = zip.length - 22; i >= 0; i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("EOCD not found");

  const entryCount = zip.readUInt16LE(eocd + 10);
  let offset = zip.readUInt32LE(eocd + 16);

  for (let i = 0; i < entryCount; i++) {
    if (zip.readUInt32LE(offset) !== 0x02014b50) throw new Error("Bad central header");
    const method = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localOffset = zip.readUInt32LE(offset + 42);
    const name = zip.subarray(offset + 46, offset + 46 + nameLength).toString("utf-8");

    if (name === entryName) {
      const localNameLength = zip.readUInt16LE(localOffset + 26);
      const localExtraLength = zip.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const raw = zip.subarray(dataStart, dataStart + compressedSize);
      return method === 8 ? inflateRawSync(raw) : Buffer.from(raw);
    }

    offset += 46 + nameLength + extraLength + commentLength;
  }

  throw new Error(`Entry not found: ${entryName}`);
}

describe("CV-TR-07 canonical transcript serialisation", () => {
  it("pack 04_Transcript.txt is byte-identical to the serialisation transcriptSha256 hashes", async () => {
    // hashCanonicalTranscript (secure-transcript.ts) hashes canonicalTranscriptText;
    // this proves the pack renders the exact same bytes, so there is one
    // authoritative transcript hash, verifiable against the pack itself.
    const pack = await packOnce();
    const entry = readZipEntry(pack, "04_Transcript.txt");
    expect(entry.toString("utf-8")).toBe(canonicalTranscriptText(fixtureSegments()));
  });

  it("canonical serialisation is order-independent", () => {
    const reversed = [...fixtureSegments()].reverse();
    expect(canonicalTranscriptText(reversed)).toBe(
      canonicalTranscriptText(fixtureSegments()),
    );
  });
});
