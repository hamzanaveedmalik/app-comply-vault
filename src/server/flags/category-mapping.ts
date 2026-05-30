import type { DisclosureCategoryStatus } from "../../../generated/prisma";
import { DISCLOSURE_CATEGORY_CATALOG } from "~/lib/disclosure-categories";

export type ProfileSkipDecision = "skip" | "raise" | "raise-mixed";

export function getImplicatedCategorySlugs(recommendationText: string): string[] {
  const text = recommendationText.trim();
  if (!text) return [];
  const matched: string[] = [];
  for (const def of DISCLOSURE_CATEGORY_CATALOG) {
    if (def.patterns.some((p) => p.test(text))) {
      matched.push(def.slug);
    }
  }
  return matched;
}

export function resolveProfileSkip(
  slugs: string[],
  profile: Map<string, DisclosureCategoryStatus> | null | undefined,
): ProfileSkipDecision {
  if (!profile || slugs.length === 0) {
    return "raise";
  }

  const statuses = slugs.map((slug) => profile.get(slug) ?? "ACTIVE");

  if (statuses.some((s) => s === "NEVER_SUPPRESS")) {
    return statuses.some((s) => s === "SUPPRESSING") ? "raise-mixed" : "raise";
  }

  if (statuses.every((s) => s === "SUPPRESSING")) {
    return "skip";
  }

  if (statuses.some((s) => s === "SUPPRESSING") && statuses.some((s) => s === "ACTIVE")) {
    return "raise-mixed";
  }

  return "raise";
}

export function getPrimaryNonSuppressedSlug(
  slugs: string[],
  profile: Map<string, DisclosureCategoryStatus> | null | undefined,
): string | null {
  for (const slug of slugs) {
    const status = profile?.get(slug) ?? "ACTIVE";
    if (status === "ACTIVE" || status === "NEVER_SUPPRESS") {
      return slug;
    }
  }
  return slugs[0] ?? null;
}

export function getSuppressedSlugsFromMixed(
  slugs: string[],
  profile: Map<string, DisclosureCategoryStatus> | null | undefined,
): string[] {
  return slugs.filter((slug) => profile?.get(slug) === "SUPPRESSING");
}
