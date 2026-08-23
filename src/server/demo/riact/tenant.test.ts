import { describe, expect, it } from "vitest";
import {
  RIACT_CLIENT_FIRMS,
  RIACT_CITATION_QUESTION,
  RIACT_COVERAGE_GAP,
  RIACT_DEMO_USER,
  RIACT_ONBOARDING_TYPE,
  RIACT_PRIMARY_CLIENT,
  RIACT_SMS_REFUSAL_QUESTION,
  isRiactClientFirmWorkspaceId,
  isRiactWorkspaceId,
  riactPrimaryWorkspaceId,
} from "~/server/demo/riact/tenant";
import { RIACT_EMAIL_MESSAGES, RIACT_MEETINGS } from "~/server/demo/riact/fixtures";
import { RIACT_PARTNER_FIRM_SNAPSHOTS } from "~/server/partner/riact-snapshots";

describe("RIACT tenant registry", () => {
  it("defines Sonoran parent and three fictional client firms", () => {
    expect(RIACT_CLIENT_FIRMS).toHaveLength(3);
    expect(RIACT_CLIENT_FIRMS.map((f) => f.name)).toEqual([
      "Cactus Wren Advisory",
      "Vermillion Cliffs Wealth",
      "Pinal Ridge Capital",
    ]);
    expect(RIACT_CLIENT_FIRMS.some((f) => f.name.includes("AdvizorStack"))).toBe(
      false,
    );
  });

  it("uses stable primary workspace and demo questions", () => {
    expect(riactPrimaryWorkspaceId()).toBe("riact-ws-cactus");
    expect(RIACT_SMS_REFUSAL_QUESTION.toLowerCase()).toContain("sms");
    expect(RIACT_CITATION_QUESTION.toLowerCase()).toContain("email");
    expect(RIACT_PRIMARY_CLIENT.name).toBe("Marcus Holloway");
  });

  it("seeds corpus within nine months with a twelve-month coverage gap", () => {
    expect(RIACT_EMAIL_MESSAGES.length).toBeGreaterThanOrEqual(40);
    expect(RIACT_EMAIL_MESSAGES.length).toBeLessThanOrEqual(60);
    expect(new Set(RIACT_EMAIL_MESSAGES.map((m) => m.threadId)).size).toBeGreaterThanOrEqual(
      18,
    );
    expect(RIACT_MEETINGS.length).toBeGreaterThanOrEqual(12);
    expect(RIACT_COVERAGE_GAP.reason.length).toBeGreaterThan(10);
  });

  it("identifies RIACT workspaces by onboarding type registry", () => {
    expect(RIACT_ONBOARDING_TYPE).toBe("SYNTHETIC_RIACT");
    expect(isRiactWorkspaceId("riact-ws-cactus")).toBe(true);
    expect(isRiactClientFirmWorkspaceId("riact-ws-sonoran")).toBe(false);
    expect(isRiactWorkspaceId("si-as-ws-secure")).toBe(false);
  });

  it("uses fixture-only partner snapshots for three firms", () => {
    expect(RIACT_PARTNER_FIRM_SNAPSHOTS).toHaveLength(3);
    expect(RIACT_DEMO_USER.email).toContain("riact.synthetic.example.com");
  });
});
