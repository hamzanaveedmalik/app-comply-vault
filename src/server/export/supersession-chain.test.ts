/**
 * CV-TR-17 — supersession chain chronology formatting.
 */

import { describe, expect, it } from "vitest";
import {
  formatSupersessionChainForPack,
  type SupersessionChainDto,
} from "./supersession-chain";

describe("formatSupersessionChainForPack", () => {
  it("renders every version with seal ID and reason between them", () => {
    const chain: SupersessionChainDto = {
      versions: [
        {
          meetingId: "m1",
          meetingDate: "2026-03-10T18:00:00.000Z",
          status: "FINALIZED",
          sealedAt: "2026-03-14T16:00:00.000Z",
          sealId: "seal_a",
          packHash: "aa".repeat(32),
          supersedeReason: "Wrong client attribution",
          versionIndex: 1,
          isCurrent: false,
        },
        {
          meetingId: "m2",
          meetingDate: "2026-03-10T18:00:00.000Z",
          status: "FINALIZED",
          sealedAt: "2026-03-20T12:00:00.000Z",
          sealId: "seal_b",
          packHash: "bb".repeat(32),
          supersedeReason: "Wrong client attribution",
          versionIndex: 2,
          isCurrent: false,
        },
        {
          meetingId: "m3",
          meetingDate: "2026-03-10T18:00:00.000Z",
          status: "DRAFT",
          sealedAt: null,
          sealId: null,
          packHash: null,
          supersedeReason: "Fee schedule correction",
          versionIndex: 3,
          isCurrent: true,
        },
      ],
      chronologyLines: [],
    };

    // Rebuild lines the same way resolveSupersessionChain would for a 3-version chain
    chain.chronologyLines = [
      "Supersession chain (one logical record; versions in chronological order):",
      "Version 1: meeting m1 (FINALIZED); seal seal_a at 2026-03-14T16:00:00.000Z.",
      "  → Superseded: Wrong client attribution",
      "Version 2: meeting m2 (FINALIZED); seal seal_b at 2026-03-20T12:00:00.000Z.",
      "  → Superseded: Fee schedule correction",
      "Version 3: meeting m3 (DRAFT); not yet sealed. [current]",
    ];

    const text = formatSupersessionChainForPack(chain);
    expect(text).toContain("one logical record");
    expect(text).toContain("seal seal_a");
    expect(text).toContain("seal seal_b");
    expect(text).toContain("Wrong client attribution");
    expect(text).toContain("Fee schedule correction");
    expect(text).toContain("[current]");
  });
});
