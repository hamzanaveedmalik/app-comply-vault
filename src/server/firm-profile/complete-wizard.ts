import type { Prisma } from "../../../generated/prisma";
import { db } from "~/server/db";
import { buildCategorySeedRows, type CategorySeedOverride } from "./seed-categories";

export type WizardCategoryToggle = {
  slug: string;
  status: "ACTIVE" | "SUPPRESSING";
  suppressionEvidence?: string;
};

export async function completeFirmProfileWizard(params: {
  workspaceId: string;
  firmProfileId: string;
  userId: string;
  categoryToggles: WizardCategoryToggle[];
}): Promise<{ success: true }> {
  const overrideMap = new Map<string, CategorySeedOverride>();
  for (const toggle of params.categoryToggles) {
    if (toggle.status === "SUPPRESSING") {
      const evidence = toggle.suppressionEvidence?.trim() ?? "";
      if (evidence.length < 20) {
        throw new Error(`Evidence required for ${toggle.slug}`);
      }
      overrideMap.set(toggle.slug, {
        slug: toggle.slug,
        status: "SUPPRESSING",
        suppressionEvidence: evidence,
      });
    }
  }

  const rows = buildCategorySeedRows(params.firmProfileId, overrideMap);

  await db.$transaction(async (tx) => {
    await tx.disclosureCategory.deleteMany({
      where: { firmProfileId: params.firmProfileId },
    });
    await tx.disclosureCategory.createMany({ data: rows });

    for (const toggle of params.categoryToggles) {
      if (toggle.status !== "SUPPRESSING") continue;
      const evidence = toggle.suppressionEvidence!.trim();
      await tx.suppressionLogEntry.create({
        data: {
          workspaceId: params.workspaceId,
          firmProfileId: params.firmProfileId,
          categorySlug: toggle.slug,
          userId: params.userId,
          action: "ACTIVATED",
          previousStatus: "ACTIVE",
          newStatus: "SUPPRESSING",
          evidenceSnapshot: evidence,
        },
      });
      await tx.auditEvent.create({
        data: {
          workspaceId: params.workspaceId,
          userId: params.userId,
          action: "DISCLOSURE_SUPPRESSION_ACTIVATED",
          resourceType: "firm_profile",
          resourceId: params.firmProfileId,
          metadata: { categorySlug: toggle.slug, source: "wizard" },
        },
      });
    }

    const snapshot: Prisma.InputJsonValue = {
      categories: rows.map((r) => ({
        slug: r.slug,
        status: r.status,
        suppressionEvidence: r.suppressionEvidence,
      })),
    };

    await tx.firmProfile.update({
      where: { id: params.firmProfileId },
      data: {
        status: "ACTIVE",
        setupCompletedAt: new Date(),
      },
    });

    await tx.firmProfileVersion.create({
      data: {
        firmProfileId: params.firmProfileId,
        workspaceId: params.workspaceId,
        versionType: "INITIAL_SETUP",
        approvedByUserId: null,
        snapshot,
      },
    });
  });

  return { success: true };
}
