import type { IapdFirmLookupResult } from "~/lib/iapd-types";

type IapdSearchHit = {
  _source?: {
    firm_source_id?: string;
    firm_name?: string;
    firm_ia_sec_number?: string;
    firm_ia_scope?: string;
    firm_ia_disclosure_fl?: string;
  };
};

type IapdSearchResponse = {
  hits?: {
    total?: number;
    hits?: IapdSearchHit[];
  };
};

export async function lookupFirmByCrd(crdNumber: string): Promise<IapdFirmLookupResult | null> {
  const normalized = crdNumber.trim();
  if (!/^\d{4,7}$/.test(normalized)) {
    return null;
  }

  const url = `https://api.adviserinfo.sec.gov/search/firm?query=${encodeURIComponent(normalized)}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "ComplyVault/1.0 (RIA compliance platform)",
    },
    next: { revalidate: 86400 },
  });

  if (!response.ok) {
    throw new Error("IAPD lookup failed");
  }

  const data = (await response.json()) as IapdSearchResponse;
  const hit = data.hits?.hits?.find(
    (candidate) => candidate._source?.firm_source_id === normalized,
  ) ?? data.hits?.hits?.[0];

  const source = hit?._source;
  if (!source?.firm_name) {
    return null;
  }

  return {
    crdNumber: source.firm_source_id ?? normalized,
    firmName: source.firm_name,
    secNumber: source.firm_ia_sec_number ?? null,
    registrationScope: source.firm_ia_scope ?? null,
    hasDisclosures: source.firm_ia_disclosure_fl === "Y",
  };
}
