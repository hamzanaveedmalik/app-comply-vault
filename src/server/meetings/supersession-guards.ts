/**
 * CV-TR-16 — Guards for supersession chains.
 * Original (superseded) and sealed replacements refuse revert / reprocess / retry.
 * Unsealed replacements may reprocess extraction, but must not wipe carried transcript via upload retry.
 */

export type SupersessionGuardMeeting = {
  status: string;
  supersedesId: string | null;
  supersededById: string | null;
};

export const SUPERSESSION_MUTATION_BLOCKED_MESSAGE =
  "This meeting is part of a supersession chain and cannot be reverted, reprocessed, or retried. Create or continue the replacement draft instead.";

export const SUPERSESSION_UPLOAD_RETRY_BLOCKED_MESSAGE =
  "Upload retry is not allowed on a supersession replacement. Reprocess the carried transcript instead.";

/**
 * True when revert / reprocess / processing-retry must be refused.
 */
export function isSupersessionMutationBlocked(
  meeting: SupersessionGuardMeeting,
): boolean {
  if (meeting.supersededById) {
    return true;
  }
  if (meeting.supersedesId && meeting.status === "FINALIZED") {
    return true;
  }
  return false;
}

export type SupersessionGuardResult =
  | { ok: true }
  | { ok: false; status: 403; error: string };

export function assertSupersessionAllowsMutation(
  meeting: SupersessionGuardMeeting,
): SupersessionGuardResult {
  if (isSupersessionMutationBlocked(meeting)) {
    return {
      ok: false,
      status: 403,
      error: SUPERSESSION_MUTATION_BLOCKED_MESSAGE,
    };
  }
  return { ok: true };
}

/**
 * Upload retry wipes transcript — never on a replacement that carries the original transcript.
 */
export function assertSupersessionAllowsUploadRetry(
  meeting: SupersessionGuardMeeting,
): SupersessionGuardResult {
  const base = assertSupersessionAllowsMutation(meeting);
  if (!base.ok) return base;
  if (meeting.supersedesId) {
    return {
      ok: false,
      status: 403,
      error: SUPERSESSION_UPLOAD_RETRY_BLOCKED_MESSAGE,
    };
  }
  return { ok: true };
}
