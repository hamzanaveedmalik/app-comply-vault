import { describe, expect, it } from "vitest";
import { extractCcoNameFromDirectOwners, formatAdvPersonName } from "~/lib/iapd-cco-name";

describe("formatAdvPersonName", () => {
  it("converts LAST, FIRST format to First Last", () => {
    expect(formatAdvPersonName("POWELL, JANICE")).toBe("Janice Powell");
    expect(formatAdvPersonName("ROSKEN, IRIS, BETH")).toBe("Iris Rosken");
  });
});

describe("extractCcoNameFromDirectOwners", () => {
  it("finds the chief compliance officer by title", () => {
    const name = extractCcoNameFromDirectOwners([
      { name: "WILKINS, ANDREW, CHARLES", titleStatus: "MANAGING PARTNER" },
      { name: "POWELL, JANICE", titleStatus: "CHIEF COMPLIANCE OFFICER" },
    ]);

    expect(name).toBe("Janice Powell");
  });

  it("matches combined titles containing chief compliance officer", () => {
    const name = extractCcoNameFromDirectOwners([
      { name: "SMITH, JANE", titleStatus: "PARTNER & CHIEF COMPLIANCE OFFICER" },
    ]);

    expect(name).toBe("Jane Smith");
  });

  it("returns null when no CCO is listed", () => {
    expect(extractCcoNameFromDirectOwners([])).toBeNull();
    expect(
      extractCcoNameFromDirectOwners([{ name: "DOE, JOHN", titleStatus: "PARTNER" }]),
    ).toBeNull();
  });
});
