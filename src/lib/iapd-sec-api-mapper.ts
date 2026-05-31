import { deriveRiskFlags } from "~/lib/risk-flags";
import type { IapdFirmLookupResult } from "~/lib/iapd-types";

export type SecApiFirmFiling = {
  Info?: {
    FirmCrdNb?: number | string;
    SECNb?: string;
    BusNm?: string;
  };
  MainAddr?: {
    City?: string;
    State?: string;
    PhNb?: string;
  };
  Filing?: Array<{ Dt?: string }>;
  FormInfo?: {
    Part1A?: Parameters<typeof deriveRiskFlags>[0] & {
      Item5F?: { Q5F2C?: string | number };
      Item5A?: { TtlEmp?: string | number };
    };
  };
};

export function mapSecApiFilingToResult(
  filing: SecApiFirmFiling,
  ccoName: string | null = null,
): IapdFirmLookupResult | null {
  const busNm = filing.Info?.BusNm;
  const crd = filing.Info?.FirmCrdNb;
  if (!busNm || crd == null) {
    return null;
  }

  const part1A = filing.FormInfo?.Part1A;

  return {
    crdNumber: String(crd),
    firmName: busNm,
    secNumber: filing.Info?.SECNb ?? null,
    registrationScope: null,
    advFilingDate: filing.Filing?.[0]?.Dt ?? null,
    aumUsd: part1A?.Item5F?.Q5F2C != null ? String(part1A.Item5F.Q5F2C) : null,
    employees: part1A?.Item5A?.TtlEmp != null ? Number(part1A.Item5A.TtlEmp) : null,
    city: filing.MainAddr?.City ?? null,
    state: filing.MainAddr?.State ?? null,
    phone: filing.MainAddr?.PhNb ?? null,
    ccoName,
    riskFlags: part1A ? deriveRiskFlags(part1A) : [],
    source: "sec-api",
  };
}
