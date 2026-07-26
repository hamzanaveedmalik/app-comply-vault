/**
 * CV-TR-01 — Object Lock retention mode gating.
 *
 * COMPLIANCE mode seals are permanent for the retention window and billable.
 * Fail closed to GOVERNANCE unless SEALED_OBJECT_LOCK_MODE is explicitly
 * "COMPLIANCE". Never infer from NODE_ENV.
 */

import { env } from "~/env";

export type ObjectLockRetentionMode = "COMPLIANCE" | "GOVERNANCE";

/**
 * Resolve Object Lock mode for sealed PUTs.
 * Unset / invalid → GOVERNANCE (fail closed).
 */
export function resolveSealedObjectLockMode(
  raw: string | undefined = env.SEALED_OBJECT_LOCK_MODE,
): ObjectLockRetentionMode {
  if (raw === "COMPLIANCE") {
    return "COMPLIANCE";
  }
  return "GOVERNANCE";
}
