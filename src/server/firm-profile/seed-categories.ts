import type { DisclosureCategoryStatus, Prisma } from "../../../generated/prisma";
import { DISCLOSURE_CATEGORY_CATALOG } from "~/lib/disclosure-categories";

export type CategorySeedOverride = {
  slug: string;
  status: DisclosureCategoryStatus;
  suppressionEvidence?: string | null;
};

export function buildCategorySeedRows(
  firmProfileId: string,
  overrides?: Map<string, CategorySeedOverride>,
): Prisma.DisclosureCategoryCreateManyInput[] {
  return DISCLOSURE_CATEGORY_CATALOG.map((def) => {
    const override = overrides?.get(def.slug);
    const status: DisclosureCategoryStatus = def.neverSuppress
      ? "NEVER_SUPPRESS"
      : (override?.status ?? "ACTIVE");
    return {
      firmProfileId,
      slug: def.slug,
      status,
      suppressionEvidence:
        status === "SUPPRESSING" ? (override?.suppressionEvidence ?? null) : null,
      description: def.description,
    };
  });
}
