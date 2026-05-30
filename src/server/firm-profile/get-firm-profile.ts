import { db } from "~/server/db";
import type {
  CockpitBundleDto,
  CockpitMetricsDto,
} from "~/lib/firm-profile-types";
import { mapDisclosureCategoryDto, mapFirmProfileDto, mapSuppressionLogDto } from "./map-dtos";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function getCockpitMetrics(workspaceId: string): Promise<CockpitMetricsDto> {
  const since = new Date(Date.now() - THIRTY_DAYS_MS);

  const [meetingsReviewed30d, flagsTotal30d] = await Promise.all([
    db.meeting.count({
      where: {
        workspaceId,
        OR: [
          { cmReviewedAt: { gte: since } },
          { ccoSignedOffAt: { gte: since } },
          { finalizedAt: { gte: since } },
        ],
      },
    }),
    db.flag.count({
      where: { workspaceId, createdAt: { gte: since } },
    }),
  ]);

  return {
    meetingsReviewed30d,
    flagsTotal30d,
    hasMeetingsReviewed30d: meetingsReviewed30d > 0,
  };
}

export async function getFirmProfileBundle(
  workspaceId: string,
  logLimit = 50,
): Promise<CockpitBundleDto> {
  const [workspace, profile, metrics] = await Promise.all([
    db.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    }),
    db.firmProfile.findFirst({
      where: { workspaceId, deletedAt: null },
      include: {
        disclosureCategories: { orderBy: { slug: "asc" } },
        suppressionLogs: {
          orderBy: { createdAt: "desc" },
          take: logLimit,
        },
        versions: {
          where: { versionType: "APPROVED" },
          orderBy: { approvedAt: "desc" },
          take: 1,
        },
      },
    }),
    getCockpitMetrics(workspaceId),
  ]);

  if (!profile) {
    return {
      profile: null,
      categories: [],
      suppressionLog: [],
      metrics,
      workspaceName: workspace?.name ?? "Workspace",
      invalidatedApprovalAt: null,
    };
  }

  const lastApproved = profile.versions[0];
  const invalidatedApprovalAt =
    lastApproved && profile.approvedAt == null
      ? lastApproved.approvedAt.toISOString()
      : null;

  const profileDto = mapFirmProfileDto(profile);
  if (lastApproved && profile.approvedAt == null) {
    profileDto.needsReapproval = true;
  }

  return {
    profile: profileDto,
    categories: profile.disclosureCategories.map(mapDisclosureCategoryDto),
    suppressionLog: profile.suppressionLogs.map(mapSuppressionLogDto),
    metrics,
    workspaceName: workspace?.name ?? "Workspace",
    invalidatedApprovalAt,
  };
}
