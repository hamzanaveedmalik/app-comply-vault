import type { Flag } from "../../generated/prisma";

/**
 * Matches GET /api/meetings/[id]/status `syncToken` so the client can detect stale UI.
 */
export function buildMeetingSyncToken(
  meetingStatus: string,
  meetingUpdatedAt: Date,
  flags: Pick<Flag, "updatedAt">[],
): string {
  let maxFlag: Date | null = null;
  for (const f of flags) {
    if (!maxFlag || f.updatedAt > maxFlag) maxFlag = f.updatedAt;
  }
  const maxIso = maxFlag?.toISOString() ?? "none";
  return `${meetingStatus}|${meetingUpdatedAt.toISOString()}|${maxIso}`;
}
