import { describe, expect, it } from "vitest";
import { loadCoverageManifest } from "./load-coverage";

describe("loadCoverageManifest", () => {
  it("returns seeded manifest from prisma", async () => {
    const manifest = await loadCoverageManifest("ws-demo", {
      indexCoverageManifest: {
        findFirst: async () => ({
          workspaceId: "ws-demo",
          sources: [
            {
              sourceType: "EMAIL",
              from: "2025-04-01T00:00:00.000Z",
              to: "2026-07-30T00:00:00.000Z",
              chunkCount: 12,
            },
          ],
          gapPeriods: [
            {
              sourceType: "EMAIL",
              from: "2024-01-01",
              to: "2024-03-31",
              reason: "Mailbox not connected for Q1 2024",
            },
          ],
          unindexedSources: [
            { name: "SMS", reason: "not connected" },
          ],
          lastIndexedAt: new Date("2026-07-30"),
        }),
      },
    });

    expect(manifest.workspaceId).toBe("ws-demo");
    expect(manifest.sources[0]?.sourceType).toBe("EMAIL");
    expect(manifest.unindexedSources.some((u) => u.name === "SMS")).toBe(true);
    expect(manifest.lastIndexedAt?.startsWith("2026-07-30")).toBe(true);
  });

  it("falls back to demo defaults when no row", async () => {
    const manifest = await loadCoverageManifest("ws-empty", {
      indexCoverageManifest: {
        findFirst: async () => null,
      },
    });
    expect(manifest.unindexedSources.some((u) => u.name === "SMS")).toBe(true);
    expect(manifest.gapPeriods.length).toBeGreaterThan(0);
  });
});
