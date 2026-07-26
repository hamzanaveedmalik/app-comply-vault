/**
 * CV-WEB-02 — Marketing integrations inventory.
 *
 * LIVE entries must match `Object.keys(adapters)` in
 * `src/server/integrations/index.ts`. CI fails on mismatch.
 */

export type LiveMarketingIntegration = {
  /** Key in the IntegrationHub `adapters` registry. */
  registryKey: string;
  label: string;
  /** How capture works for this connector today. */
  capture: "auto-ingest";
};

export type RoadmapMarketingIntegration = {
  label: string;
  /** No ship dates — CV-WEB-02. */
  note: string;
};

/**
 * Connectors that may be marketed as live.
 * Must stay in lockstep with `src/server/integrations/index.ts` `adapters`.
 */
export const MARKETING_LIVE_INTEGRATIONS: readonly LiveMarketingIntegration[] = [
  {
    registryKey: "zoom",
    label: "Zoom",
    capture: "auto-ingest",
  },
] as const;

export const MARKETING_LIVE_REGISTRY_KEYS: readonly string[] =
  MARKETING_LIVE_INTEGRATIONS.map((i) => i.registryKey);

/**
 * Forthcoming connectors — visibly separated from live; no dates.
 */
export const MARKETING_ROADMAP_INTEGRATIONS: readonly RoadmapMarketingIntegration[] =
  [
    { label: "Microsoft Teams", note: "Capture path not yet in the live adapter registry" },
    { label: "SharePoint", note: "Deposit convenience copy exists in-product; not a capture source" },
    { label: "Zoho CRM", note: "CRM note posting exists in-product; not a capture source" },
    { label: "Google Meet", note: "Not built" },
    { label: "Redtail", note: "Not built" },
  ] as const;

export const MANUAL_UPLOAD_COPY =
  "Manual upload (audio, video, or transcript) is supported for meetings from any platform.";

export const LIVE_CAPTURE_LEAD_COPY =
  "Zoom auto-ingest is the production-wired capture path. Manual upload covers all other platforms.";
