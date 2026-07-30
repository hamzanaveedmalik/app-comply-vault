/**
 * CV-OB-01 — Deterministic identity resolution contract.
 * Name similarity never auto-confirms.
 */

export type IdentityResolutionMethod =
  | "exact_email"
  | "domain_household"
  | "crm_identifier"
  | "name_exact_held"
  | "unmatched"
  | "ambiguous";

export type IdentityResolutionConfidence =
  | "high"
  | "medium"
  | "low"
  | "none";

export type IdentityResolution = {
  addressOrName: string;
  clientId: string | null;
  userId: string | null;
  method: IdentityResolutionMethod;
  confidence: IdentityResolutionConfidence;
  /** Low confidence must never auto-resolve — UI shows held state. */
  heldForConfirmation: boolean;
  reason?: string;
};

export function resolutionFromParticipantMatch(args: {
  address: string;
  clientId: string | null;
  userId: string | null;
  source: "alias" | "user" | "client" | "household" | "zoho" | "triage";
  verified: boolean;
}): IdentityResolution {
  if (args.source === "triage" || !args.verified) {
    return {
      addressOrName: args.address,
      clientId: null,
      userId: null,
      method: "unmatched",
      confidence: "none",
      heldForConfirmation: true,
      reason: "routed_to_triage",
    };
  }

  if (args.source === "alias" || args.source === "client" || args.source === "user") {
    return {
      addressOrName: args.address,
      clientId: args.clientId,
      userId: args.userId,
      method: "exact_email",
      confidence: "high",
      heldForConfirmation: false,
    };
  }

  if (args.source === "household") {
    return {
      addressOrName: args.address,
      clientId: args.clientId,
      userId: args.userId,
      method: "domain_household",
      confidence: "medium",
      heldForConfirmation: false,
      reason: "exact_email_on_household_peer",
    };
  }

  if (args.source === "zoho") {
    return {
      addressOrName: args.address,
      clientId: args.clientId,
      userId: args.userId,
      method: "crm_identifier",
      confidence: "high",
      heldForConfirmation: false,
    };
  }

  return {
    addressOrName: args.address,
    clientId: null,
    userId: null,
    method: "unmatched",
    confidence: "none",
    heldForConfirmation: true,
  };
}

/**
 * Name-only matches are always held — never auto-confirm (CV-OB-01).
 */
export function heldNameResolution(args: {
  name: string;
  proposedClientId: string;
  reason?: string;
}): IdentityResolution {
  return {
    addressOrName: args.name,
    clientId: args.proposedClientId,
    userId: null,
    method: "name_exact_held",
    confidence: "low",
    heldForConfirmation: true,
    reason: args.reason ?? "name_similarity_never_auto_confirms",
  };
}

export function ambiguousResolution(args: {
  addressOrName: string;
  reason: string;
}): IdentityResolution {
  return {
    addressOrName: args.addressOrName,
    clientId: null,
    userId: null,
    method: "ambiguous",
    confidence: "none",
    heldForConfirmation: true,
    reason: args.reason,
  };
}

/** Auto-link only when not held. */
export function mayAutoLink(resolution: IdentityResolution): boolean {
  return (
    !resolution.heldForConfirmation &&
    resolution.clientId !== null &&
    (resolution.confidence === "high" || resolution.confidence === "medium")
  );
}
