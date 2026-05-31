import { describe, expect, it } from "vitest";
import {
  createDraftSchema,
  hasRequiredFirmIdentity,
  validateStep1Client,
} from "~/lib/firm-profile-schemas";

describe("validateStep1Client", () => {
  it("blocks continue when CRD and CCO are empty", () => {
    const result = validateStep1Client({
      crdNumber: "",
      ccoName: "  ",
      advFilingDate: "",
      aumUsd: "",
    });

    expect(result.canContinue).toBe(false);
    expect(result.errors.crdNumber).toBeTruthy();
    expect(result.errors.ccoName).toBeTruthy();
  });

  it("allows continue with required fields and emits soft warnings for optional fields", () => {
    const result = validateStep1Client({
      crdNumber: "106389",
      ccoName: "Janice Powell",
      advFilingDate: "",
      aumUsd: "",
    });

    expect(result.canContinue).toBe(true);
    expect(result.errors).toEqual({});
    expect(result.warnings.advFilingDate).toBeTruthy();
    expect(result.warnings.aumUsd).toBeTruthy();
  });
});

describe("createDraftSchema", () => {
  it("rejects empty CRD and CCO on the server", () => {
    const result = createDraftSchema.safeParse({
      crdNumber: "   ",
      ccoName: "",
    });

    expect(result.success).toBe(false);
  });

  it("accepts trimmed required fields", () => {
    const result = createDraftSchema.safeParse({
      crdNumber: "106389",
      ccoName: "Janice Powell",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.crdNumber).toBe("106389");
      expect(result.data.ccoName).toBe("Janice Powell");
    }
  });
});

describe("hasRequiredFirmIdentity", () => {
  it("requires both CRD and CCO", () => {
    expect(hasRequiredFirmIdentity({ crdNumber: "106389", ccoName: null })).toBe(false);
    expect(hasRequiredFirmIdentity({ crdNumber: null, ccoName: "Janice Powell" })).toBe(false);
    expect(hasRequiredFirmIdentity({ crdNumber: "106389", ccoName: "Janice Powell" })).toBe(true);
  });
});
