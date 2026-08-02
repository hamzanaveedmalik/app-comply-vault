/**
 * CV-OB / N2 — copy contract for the post-connect reveal.
 * Never claim mailbox disclosure until a sync timestamp exists.
 */

export type ZeroSetupCopy = {
  heading: string;
  body: string;
  cta: string;
};

export function zeroSetupCopy(input: {
  synced: boolean;
  totalOpenItems: number;
}): ZeroSetupCopy {
  if (input.synced) {
    return {
      heading: "First evidence — no client records typed",
      body: "Open items below are from this workspace after sync. Ambiguous identities stay held for confirmation rather than silently assigned — that is the product working, not unfinished setup.",
      cta:
        input.totalOpenItems > 0
          ? "What the mailbox disclosed"
          : "Open Needs Attention",
    };
  }

  return {
    heading: "Connect, then sync — no client records to type",
    body: "These counts are workspace open items, not a live read of Gmail. Run Backfill or Delta sync so evidence comes from the connected mailbox. Do not present seed rows as mailbox disclosure.",
    cta:
      input.totalOpenItems > 0 ? "Review open items" : "Open Needs Attention",
  };
}
