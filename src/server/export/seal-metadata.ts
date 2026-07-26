/**
 * CV-TR-02 — Seal metadata embedded in sealed pack cover / deposit derivatives.
 */

export type PackSealMetadata = {
  sealId: string;
  sealedAt: Date;
  expiresAt?: Date;
  /**
   * Hex SHA-256 shown on the cover.
   * For sealed Object Lock bytes this is the pass-1 content digest
   * (see seal-meeting two-pass). Deposit derivatives may show the ledger packHash.
   */
  packHash: string;
  /**
   * CV-TR-18 — custody footer on every PDF page (deposit / convenience copies only).
   * Never set on Object Lock sealed bytes.
   */
  custodyFooter?: string;
};

/** Phase 1 cover copy — no verify URL, no third-party implication. */
export const SEAL_COVER_COPY =
  "This pack is sealed. Retain the seal ID and hash. ComplyVault can confirm on request that this hash matches its ledger entry.";

export function depositCustodyFooter(sealId: string): string {
  return `Convenience copy. The sealed record held by ComplyVault under seal ${sealId} is the system of record.`;
}
