import "server-only";

import {
  extractCcoNameFromDirectOwners,
  type SecApiDirectOwner,
} from "~/lib/iapd-cco-name";
import { mapSecApiFilingToResult } from "~/lib/iapd-sec-api-mapper";
import type { IapdFirmLookupResult } from "~/lib/iapd-types";

type SecApiFirmResponse = {
  filings?: Parameters<typeof mapSecApiFilingToResult>[0][];
};

type SecApiDirectOwnersResponse = {
  directOwners?: SecApiDirectOwner[];
};

const SEC_API_FIRM_URL = "https://api.sec-api.io/form-adv/firm";

function scheduleADirectOwnersUrl(crd: string): string {
  return `https://api.sec-api.io/form-adv/schedule-a-direct-owners/${encodeURIComponent(crd)}`;
}

async function fetchCcoNameFromScheduleA(
  crd: string,
  apiKey: string,
): Promise<string | null> {
  try {
    const response = await fetch(scheduleADirectOwnersUrl(crd), {
      headers: { Authorization: apiKey },
      // 24-hour cache aligned with ADV daily update schedule (5–7:30am EST)
      next: { revalidate: 86400 },
    });

    if (!response.ok) {
      console.error("[sec-api] schedule A lookup failed", { status: response.status, crd });
      return null;
    }

    const data = (await response.json()) as SecApiDirectOwnersResponse | SecApiDirectOwner[];
    const owners = Array.isArray(data) ? data : data.directOwners;
    return extractCcoNameFromDirectOwners(owners);
  } catch (error) {
    console.error("[sec-api] schedule A lookup error", { crd, error });
    return null;
  }
}

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
    const [firmResponse, ccoName] = await Promise.all([
      fetch(SEC_API_FIRM_URL, {
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
      }),
      fetchCcoNameFromScheduleA(normalized, apiKey),
    ]);

    if (!firmResponse.ok) {
      console.error("[sec-api] firm lookup failed", {
        status: firmResponse.status,
        crd: normalized,
      });
      return null;
    }

    const data = (await firmResponse.json()) as SecApiFirmResponse;
    const filing = data.filings?.[0];
    if (!filing) {
      return null;
    }

    return mapSecApiFilingToResult(filing, ccoName);
  } catch (error) {
    console.error("[sec-api] firm lookup error", { crd: normalized, error });
    return null;
  }
}
