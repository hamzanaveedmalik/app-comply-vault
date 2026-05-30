import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { z } from "zod";
import {
  canWriteCockpit,
  getWorkspaceMembership,
} from "~/server/firm-profile/workspace-access";
import {
  ToggleSuppressionError,
  toggleCategorySuppression,
} from "~/server/firm-profile/toggle-category-suppression";
import { getCategoryBySlug } from "~/lib/disclosure-categories";
import { mapDisclosureCategoryDto } from "~/server/firm-profile/map-dtos";

const toggleSchema = z
  .object({
    status: z.enum(["ACTIVE", "SUPPRESSING"]),
    suppressionEvidence: z.string().min(20).optional(),
  })
  .refine(
    (d) =>
      d.status !== "SUPPRESSING" ||
      (d.suppressionEvidence !== undefined && d.suppressionEvidence.length >= 20),
    { message: "Evidence required when suppressing (minimum 20 characters)." },
  );

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; slug: string }> },
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId, slug } = await params;
  const access = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!access.ok) {
    return Response.json({ error: "Forbidden" }, { status: access.status });
  }
  if (!canWriteCockpit(access.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const def = getCategoryBySlug(slug);
  if (!def) {
    return Response.json({ error: "Unknown category" }, { status: 404 });
  }
  if (def.neverSuppress) {
    return Response.json({ error: "Category cannot be suppressed" }, { status: 400 });
  }

  const profile = await db.firmProfile.findFirst({
    where: { workspaceId, deletedAt: null, status: "ACTIVE" },
  });
  if (!profile) {
    return Response.json({ error: "Active firm profile required" }, { status: 404 });
  }

  let parsed: z.infer<typeof toggleSchema>;
  try {
    parsed = toggleSchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: err.errors[0]?.message ?? "Validation failed" }, { status: 422 });
    }
    throw err;
  }

  try {
    await toggleCategorySuppression({
      workspaceId,
      firmProfileId: profile.id,
      slug,
      userId: session.user.id,
      status: parsed.status,
      suppressionEvidence: parsed.suppressionEvidence,
    });
  } catch (err) {
    if (err instanceof ToggleSuppressionError) {
      const status = err.code === "VALIDATION" ? 422 : err.code === "FORBIDDEN" ? 400 : 404;
      return Response.json({ error: err.message }, { status });
    }
    throw err;
  }

  const category = await db.disclosureCategory.findFirst({
    where: { firmProfileId: profile.id, slug },
  });

  return Response.json({
    success: true,
    data: category ? mapDisclosureCategoryDto(category) : null,
  });
}
