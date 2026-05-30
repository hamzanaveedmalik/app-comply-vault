import type { DisclosureCategoryStatus } from "../../../generated/prisma";
import { getCategoryBySlug } from "~/lib/disclosure-categories";
import { db } from "~/server/db";

export class ToggleSuppressionError extends Error {
  constructor(
    message: string,
    public readonly code: "VALIDATION" | "FORBIDDEN" | "NOT_FOUND",
  ) {
    super(message);
  }
}

export type ToggleCategoryInput = {
  workspaceId: string;
  firmProfileId: string;
  slug: string;
  userId: string;
  status: "ACTIVE" | "SUPPRESSING";
  suppressionEvidence?: string;
  meetingId?: string;
};

export async function toggleCategorySuppression(
  input: ToggleCategoryInput,
): Promise<{ success: true; category: { slug: string; status: DisclosureCategoryStatus } }> {
  const def = getCategoryBySlug(input.slug);
  if (!def) {
    throw new ToggleSuppressionError("Unknown category slug", "NOT_FOUND");
  }
  if (def.neverSuppress) {
    throw new ToggleSuppressionError("Category cannot be suppressed", "FORBIDDEN");
  }

  if (input.status === "SUPPRESSING") {
    const evidence = input.suppressionEvidence?.trim() ?? "";
    if (evidence.length < 20) {
      throw new ToggleSuppressionError(
        "Evidence required when suppressing (minimum 20 characters).",
        "VALIDATION",
      );
    }
  }

  const category = await db.disclosureCategory.findFirst({
    where: { firmProfileId: input.firmProfileId, slug: input.slug },
  });

  if (!category) {
    throw new ToggleSuppressionError("Category not found", "NOT_FOUND");
  }

  const previousStatus = category.status;
  const newStatus: DisclosureCategoryStatus = input.status;
  const evidenceSnapshot =
    newStatus === "SUPPRESSING" ? (input.suppressionEvidence?.trim() ?? null) : null;

  await db.$transaction(async (tx) => {
    await tx.disclosureCategory.update({
      where: { id: category.id },
      data: {
        status: newStatus,
        suppressionEvidence: newStatus === "SUPPRESSING" ? evidenceSnapshot : null,
      },
    });

    const profileUpdate: { approvedAt: null; approvedByUserId: null } | Record<string, never> =
      newStatus !== previousStatus
        ? { approvedAt: null, approvedByUserId: null }
        : {};

    if (Object.keys(profileUpdate).length > 0) {
      await tx.firmProfile.update({
        where: { id: input.firmProfileId },
        data: profileUpdate,
      });
    }

    const action = newStatus === "SUPPRESSING" ? "ACTIVATED" : "DEACTIVATED";
    const auditAction =
      newStatus === "SUPPRESSING"
        ? "DISCLOSURE_SUPPRESSION_ACTIVATED"
        : "DISCLOSURE_SUPPRESSION_DEACTIVATED";

    await tx.suppressionLogEntry.create({
      data: {
        workspaceId: input.workspaceId,
        firmProfileId: input.firmProfileId,
        categorySlug: input.slug,
        userId: input.userId,
        meetingId: input.meetingId ?? null,
        action,
        previousStatus,
        newStatus,
        evidenceSnapshot,
      },
    });

    await tx.auditEvent.create({
      data: {
        workspaceId: input.workspaceId,
        userId: input.userId,
        action: auditAction,
        resourceType: "firm_profile",
        resourceId: input.firmProfileId,
        metadata: {
          categorySlug: input.slug,
          previousStatus,
          newStatus,
          evidenceSnapshot,
        },
      },
    });
  });

  return { success: true, category: { slug: input.slug, status: newStatus } };
}
