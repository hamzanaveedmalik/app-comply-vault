import { describe, expect, it } from "vitest";
import { scanForRegulatoryCitations } from "./regulatory-guard";

describe("scanForRegulatoryCitations", () => {
  it("allows clean prose", () => {
    const r = scanForRegulatoryCitations(
      "On May 14 with Rob Cabrera, fees were discussed and the client agreed."
    );
    expect(r.blocked).toBe(false);
  });

  it("blocks CFR references", () => {
    expect(scanForRegulatoryCitations("see 17 CFR § 275 for details").blocked).toBe(true);
    expect(scanForRegulatoryCitations("17 C.F.R. 275.204-2").blocked).toBe(true);
  });

  it("blocks SEC Rule references", () => {
    expect(scanForRegulatoryCitations("per Rule 206(4)-7").blocked).toBe(true);
    expect(scanForRegulatoryCitations("under Rule 204-2").blocked).toBe(true);
  });

  it("blocks Section sub-paragraph references", () => {
    expect(scanForRegulatoryCitations("Section 206(4)").blocked).toBe(true);
    expect(scanForRegulatoryCitations("Section 204(a)(1)").blocked).toBe(true);
  });

  it("blocks Advisers Act / Securities Exchange Act mentions", () => {
    expect(scanForRegulatoryCitations("the Advisers Act requires…").blocked).toBe(true);
    expect(scanForRegulatoryCitations("the Investment Advisers Act of 1940").blocked).toBe(true);
  });

  it("blocks ADV item references", () => {
    expect(scanForRegulatoryCitations("ADV Part 2A Item 5 covers fees").blocked).toBe(true);
  });

  it("does not block mention of fees, dates, or client names", () => {
    expect(
      scanForRegulatoryCitations(
        "On 2026-05-14 with Sarah Johnson, fees moved to the 1.25% tier."
      ).blocked
    ).toBe(false);
  });
});
