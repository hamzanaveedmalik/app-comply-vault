import "server-only";

import { mapSecApiFilingToResult } from "~/lib/iapd-sec-api-mapper";
import type { IapdFirmLookupResult } from "~/lib/iapd-types";

type SecApiFirmResponse = {
  filings?: Parameters<typeof mapSecApiFilingToResult>[0][];
};

const SEC_API_URL = "https://api.sec-api.io/form-adv/firm";

export async function lookupFirmByCrdSecApi(
  crdNumber: string,
): Promise<IapdFirmLookupResult | null> {
  const apiKey = process.env.SEC_API_KEY;
  if (!apiKey) {
    return null;
  }

  const normalized = crdNumber.trim();
  if (!/^\d{4,7}$/.test(normalized)) {
    return null;
  }

  try {
    const response = await fetch(SEC_API_URL, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `Info.FirmCrdNb:${normalized}`,
        from: "0",
        size: "1",
        sort: [{ "Filing.Dt": { order: "desc" } }],
      }),
      // 24-hour cache aligned with ADV daily update schedule (5–7:30am EST)
      next: { revalidate: 86400 },
    });

    if (!response.ok) {
      console.error("[sec-api] firm lookup failed", { status: response.status, crd: normalized });
      return null;
    }

    const data = (await response.json()) as SecApiFirmResponse;
    const filing = data.filings?.[0];
    if (!filing) {
      return null;
    }

    return mapSecApiFilingToResult(filing);
  } catch (error) {
    console.error("[sec-api] firm lookup error", { crd: normalized, error });
    return null;
  }
}
