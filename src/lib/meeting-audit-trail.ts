import type { AuditAction } from "../../generated/prisma";

export type MeetingAuditTrailEntry = {
  id: string;
  actionLabel: string;
  actorDisplay: string;
  timestampIso: string;
  detailLine: string | null;
  variant: MeetingAuditTrailVariant;
};

export type MeetingAuditTrailVariant =
  | "finalize"
  | "cco"
  | "cm"
  | "advisor"
  | "revert"
  | "flag"
  | "export"
  | "edit"
  | "generic";

type AuditEventRow = {
  id: string;
  action: AuditAction;
  userId: string;
  timestamp: Date;
  metadata: unknown;
  resourceType: string;
  resourceId: string;
};

function actorLabel(userId: string, userNames: ReadonlyMap<string, string>): string {
  if (userId === "system") return "ComplyVault";
  return userNames.get(userId) ?? "Team member";
}

function formatFlagTitle(flagType: string | undefined): string {
  if (!flagType) return "Flag";
  return flagType.replace(/_/g, " ");
}

function revertTargetLabel(revertTo: string | undefined): string {
  if (revertTo === "ADVISOR_CERTIFIED") return "advisor certified";
  if (revertTo === "CM_REVIEWED") return "CM reviewed";
  return revertTo?.replace(/_/g, " ").toLowerCase() ?? "earlier stage";
}

function cmReviewDetail(metadata: Record<string, unknown> | null): string | null {
  if (!metadata) return null;
  const resolved = metadata.resolved;
  const noted = metadata.noted;
  const escalated = metadata.escalated;
  if (
    typeof resolved !== "number" ||
    typeof noted !== "number" ||
    typeof escalated !== "number"
  ) {
    return null;
  }
  return `${resolved} resolved · ${noted} noted · ${escalated} escalated to CCO`;
}

export function buildMeetingAuditTrailEntries(
  events: AuditEventRow[],
  userNames: ReadonlyMap<string, string>,
  flagTypeById: ReadonlyMap<string, string>,
): MeetingAuditTrailEntry[] {
  const out: MeetingAuditTrailEntry[] = [];

  for (const ev of events) {
    const meta =
      ev.metadata !== null && typeof ev.metadata === "object" && !Array.isArray(ev.metadata)
        ? (ev.metadata as Record<string, unknown>)
        : null;
    const actor = actorLabel(ev.userId, userNames);

    if (ev.action === "VIEW") continue;

    if (ev.action === "ADVISOR_CERTIFIED") {
      out.push({
        id: ev.id,
        actionLabel: "Advisor certified transcript accuracy",
        actorDisplay: actor,
        timestampIso: ev.timestamp.toISOString(),
        detailLine: null,
        variant: "advisor",
      });
      continue;
    }

    if (ev.action === "CM_REVIEW_COMPLETED") {
      out.push({
        id: ev.id,
        actionLabel: "Compliance manager completed flag review",
        actorDisplay: actor,
        timestampIso: ev.timestamp.toISOString(),
        detailLine: cmReviewDetail(meta),
        variant: "cm",
      });
      continue;
    }

    if (ev.action === "CCO_SIGNED_OFF") {
      out.push({
        id: ev.id,
        actionLabel: "CCO signed off compliance review",
        actorDisplay: actor,
        timestampIso: ev.timestamp.toISOString(),
        detailLine: null,
        variant: "cco",
      });
      continue;
    }

    if (ev.action === "FINALIZE") {
      out.push({
        id: ev.id,
        actionLabel: "Meeting finalized",
        actorDisplay: actor,
        timestampIso: ev.timestamp.toISOString(),
        detailLine: null,
        variant: "finalize",
      });
      continue;
    }

    if (ev.action === "WORKFLOW_REVERTED") {
      const reason = typeof meta?.reason === "string" ? meta.reason : null;
      const revertTo = typeof meta?.revertTo === "string" ? meta.revertTo : undefined;
      out.push({
        id: ev.id,
        actionLabel: `Workflow reverted to ${revertTargetLabel(revertTo)}`,
        actorDisplay: actor,
        timestampIso: ev.timestamp.toISOString(),
        detailLine: reason,
        variant: "revert",
      });
      continue;
    }

    if (ev.action === "EXPORT") {
      out.push({
        id: ev.id,
        actionLabel: "Audit pack exported",
        actorDisplay: actor,
        timestampIso: ev.timestamp.toISOString(),
        detailLine: null,
        variant: "export",
      });
      continue;
    }

    if (ev.action === "EDIT" && ev.resourceType === "meeting") {
      const reason = typeof meta?.reason === "string" ? meta.reason : null;
      out.push({
        id: ev.id,
        actionLabel: "Meeting record updated",
        actorDisplay: actor,
        timestampIso: ev.timestamp.toISOString(),
        detailLine: reason,
        variant: "edit",
      });
      continue;
    }

    if (ev.action === "REMEDIATION_UPDATE" && ev.resourceType === "flag") {
      const triage = meta?.cmTriage;
      const flagId = typeof meta?.flagId === "string" ? meta.flagId : ev.resourceId;
      const title = formatFlagTitle(flagTypeById.get(flagId));
      if (triage === "resolve") {
        out.push({
          id: ev.id,
          actionLabel: `Flag resolved: ${title}`,
          actorDisplay: actor,
          timestampIso: ev.timestamp.toISOString(),
          detailLine: null,
          variant: "flag",
        });
      } else if (triage === "note") {
        out.push({
          id: ev.id,
          actionLabel: `Note added to flag: ${title}`,
          actorDisplay: actor,
          timestampIso: ev.timestamp.toISOString(),
          detailLine: null,
          variant: "flag",
        });
      } else {
        out.push({
          id: ev.id,
          actionLabel: "Flag remediation updated",
          actorDisplay: actor,
          timestampIso: ev.timestamp.toISOString(),
          detailLine: title,
          variant: "flag",
        });
      }
      continue;
    }

    if (ev.action === "REMEDIATION_START" && ev.resourceType === "flag") {
      const triage = meta?.cmTriage;
      const flagId = typeof meta?.flagId === "string" ? meta.flagId : ev.resourceId;
      const title = formatFlagTitle(flagTypeById.get(flagId));
      if (triage === "escalate") {
        out.push({
          id: ev.id,
          actionLabel: `Flag escalated to CCO: ${title}`,
          actorDisplay: actor,
          timestampIso: ev.timestamp.toISOString(),
          detailLine: null,
          variant: "flag",
        });
      } else {
        out.push({
          id: ev.id,
          actionLabel: "Remediation started",
          actorDisplay: actor,
          timestampIso: ev.timestamp.toISOString(),
          detailLine: title,
          variant: "flag",
        });
      }
      continue;
    }

    if (ev.action === "UPLOAD" && ev.resourceType === "meeting") {
      const inner = typeof meta?.action === "string" ? meta.action : null;
      if (inner === "extraction_complete") {
        out.push({
          id: ev.id,
          actionLabel: "Meeting processed by ComplyVault",
          actorDisplay: actor,
          timestampIso: ev.timestamp.toISOString(),
          detailLine: null,
          variant: "generic",
        });
      }
      continue;
    }
  }

  return out;
}
