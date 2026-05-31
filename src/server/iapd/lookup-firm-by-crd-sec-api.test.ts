import { describe, expect, it } from "vitest";
import { mapSecApiFilingToResult } from "~/lib/iapd-sec-api-mapper";

describe("mapSecApiFilingToResult", () => {
  it("maps sec-api filing shape to IapdFirmLookupResult", () => {
    const result = mapSecApiFilingToResult({
      Info: {
        FirmCrdNb: 141195,
        SECNb: "801-80752",
        BusNm: "SECURE INVESTMENT MANAGEMENT, LLC",
      },
      MainAddr: {
        City: "TUCSON",
        State: "AZ",
        PhNb: "520-333-4719",
      },
      Filing: [{ Dt: "2026-04-16" }],
      FormInfo: {
        Part1A: {
          Item5F: { Q5F2C: 42909330 },
          Item5A: { TtlEmp: 31 },
          Item11D: { Q11D2: "Y" },
          Item7A: { Q7A12: "Y", Q7A16: "N" },
          Item5B: { Q5B5: 2 },
          Item2A: { Q2A10: "N" },
        },
      },
    });

    expect(result).toEqual({
      crdNumber: "141195",
      firmName: "SECURE INVESTMENT MANAGEMENT, LLC",
      secNumber: "801-80752",
      registrationScope: null,
      advFilingDate: "2026-04-16",
      aumUsd: "42909330",
      employees: 31,
      city: "TUCSON",
      state: "AZ",
      phone: "520-333-4719",
      riskFlags: ["Regulatory History", "Dual-Hat Advisors", "Insurance Affiliate"],
      source: "sec-api",
    });
  });

  it("returns null when required firm identity is missing", () => {
    expect(mapSecApiFilingToResult({ Info: { FirmCrdNb: 141195 } })).toBeNull();
  });
});
