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
          // Insurance-licensed agents (Item 5.B.(5)) but no broker-dealer reps
          // (Item 5.B.(2)) — must NOT produce a Dual-Hat flag.
          Item5B: { Q5B2: 0 },
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
      ccoName: null,
      riskFlags: ["Regulatory History", "Insurance Affiliate"],
      source: "sec-api",
    });
  });

  it("includes CCO name when provided from Schedule A", () => {
    const result = mapSecApiFilingToResult(
      {
        Info: { FirmCrdNb: 141195, BusNm: "SECURE INVESTMENT MANAGEMENT, LLC" },
      },
      "Janice Powell",
    );

    expect(result?.ccoName).toBe("Janice Powell");
  });

  it("returns null when required firm identity is missing", () => {
    expect(mapSecApiFilingToResult({ Info: { FirmCrdNb: 141195 } })).toBeNull();
  });
});
