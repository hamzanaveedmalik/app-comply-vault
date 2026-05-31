export type IapdFirmLookupResult = {
  crdNumber: string;
  firmName: string;
  secNumber: string | null;
  registrationScope: string | null;
  advFilingDate: string | null;
  aumUsd: string | null;
  employees: number | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  riskFlags: string[];
  source: "sec-api" | "iapd-search";
};
