"use client";

import { useState } from "react";
import type { IapdFirmLookupResult } from "~/lib/iapd-types";

export type IapdLookupStatus = "idle" | "loading" | "found" | "not_found" | "error";

export type CrdLookupSetters = {
  setAdvFilingDate: (value: string) => void;
  setAumUsd: (value: string) => void;
  setRiskFlags: (flags: string[]) => void;
  setIapdFirm: (firm: IapdFirmLookupResult | null) => void;
  setIapdLookup: (status: IapdLookupStatus) => void;
};

export function useCrdLookup(setters: CrdLookupSetters): {
  lookup: (crd: string) => Promise<void>;
  error: string | null;
} {
  const [error, setError] = useState<string | null>(null);

  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const minDelayMs = isDemoMode ? 800 : 0;
  const timeoutMs = 5000;

  const lookup = async (crd: string): Promise<void> => {
    const normalized = crd.trim();
    if (!/^\d{4,7}$/.test(normalized)) {
      return;
    }

    setters.setIapdLookup("loading");
    setters.setIapdFirm(null);
    setError(null);

    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`/api/iapd/firm/${encodeURIComponent(normalized)}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error("lookup_failed");
      }

      const json = (await res.json()) as {
        success: boolean;
        data: IapdFirmLookupResult | null;
      };
      if (!json.success || !json.data) {
        setters.setIapdLookup("not_found");
        return;
      }

      const firm = json.data;
      const elapsed = Date.now() - start;
      if (elapsed < minDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, minDelayMs - elapsed));
      }

      setters.setIapdFirm(firm);
      setters.setAdvFilingDate(firm.advFilingDate?.slice(0, 10) ?? "");
      setters.setAumUsd(firm.aumUsd ?? "");
      setters.setRiskFlags(firm.riskFlags);
      setters.setIapdLookup("found");
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("Unable to fetch firm data — please enter manually.");
      } else {
        setError(
          `No SEC-registered firm found for CRD ${normalized}. Please check and retry or enter details manually.`,
        );
      }
      setters.setIapdLookup("error");
    }
  };

  return { lookup, error };
}
