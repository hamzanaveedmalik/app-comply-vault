import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { z } from "zod";
import { getFirmProfileBundle } from "~/server/firm-profile/get-firm-profile";
import { buildCategorySeedRows } from "~/server/firm-profile/seed-categories";
import {
  canWriteCockpit,
  getWorkspaceMembership,
} from "~/server/firm-profile/workspace-access";
import { mapFirmProfileDto } from "~/server/firm-profile/map-dtos";

const createDraftSchema = z.object({
  status: z.literal("DRAFT").optional(),
  crdNumber: z.string().optional(),
  ccoName: z.string().optional(),
  advFilingDate: z.string().datetime().optional().nullable(),
  aumUsd: z.union([z.string(), z.number()]).optional().nullable(),
  advDocumentUrl: z.string().url().optional().nullable().or(z.literal("")),
  riskFlags: z.array(z.string()).optional(),
});

const patchProfileSchema = z.object({
  crdNumber: z.string().optional(),
  ccoName: z.string().optional(),
  advFilingDate: z.string().datetime().optional().nullable(),
  aumUsd: z.union([z.string(), z.number()]).optional().nullable(),
  advDocumentUrl: z.string().url().optional().nullable().or(z.literal("")),
  riskFlags: z.array(z.string()).optional(),
});

const completeWizardSchema = z.object({
  neverSuppressAcknowledged: z.literal(true),
  categoryToggles: z
    .array(
      z.object({
        slug: z.string(),
        status: z.enum(["ACTIVE", "SUPPRESSING"]),
        suppressionEvidence: z.string().min(20).optional(),
      }),
    )
    .optional(),
});

function parseAum(value: string | number | null | undefined): string | null {
  if (value == null || value === "") return null;
  return String(value);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId } = await params;
  const access = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!access.ok) {
    return Response.json({ error: "Forbidden" }, { status: access.status });
  }

  const bundle = await getFirmProfileBundle(workspaceId);
  return Response.json({
    success: true,
    data: {
      ...bundle,
      canWrite: canWriteCockpit(access.role),
    },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId } = await params;
  const access = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!access.ok) {
    return Response.json({ error: "Forbidden" }, { status: access.status });
  }
  if (!canWriteCockpit(access.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createDraftSchema.parse(body);

  const existing = await db.firmProfile.findFirst({
    where: { workspaceId, deletedAt: null },
  });
  if (existing) {
    return Response.json({ success: true, data: { profile: mapFirmProfileDto(existing) } });
  }

  const profile = await db.firmProfile.create({
    data: {
      workspaceId,
      status: "DRAFT",
      crdNumber: parsed.crdNumber ?? null,
      ccoName: parsed.ccoName ?? null,
      advFilingDate: parsed.advFilingDate ? new Date(parsed.advFilingDate) : null,
      aumUsd: parseAum(parsed.aumUsd),
      advDocumentUrl: parsed.advDocumentUrl || null,
      riskFlags: parsed.riskFlags ?? [],
    },
  });

  return Response.json({ success: true, data: { profile: mapFirmProfileDto(profile) } });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId } = await params;
  const access = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!access.ok) {
    return Response.json({ error: "Forbidden" }, { status: access.status });
  }
  if (!canWriteCockpit(access.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();

  if ("neverSuppressAcknowledged" in body) {
    const wizard = completeWizardSchema.parse(body);
    const profile = await db.firmProfile.findFirst({
      where: { workspaceId, deletedAt: null },
    });
    if (!profile) {
      return Response.json({ error: "Profile not found" }, { status: 404 });
    }

    const { completeFirmProfileWizard } = await import(
      "~/server/firm-profile/complete-wizard"
    );
    try {
      await completeFirmProfileWizard({
        workspaceId,
        firmProfileId: profile.id,
        userId: session.user.id,
        categoryToggles: wizard.categoryToggles ?? [],
      });
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : "Wizard failed" },
        { status: 422 },
      );
    }

    const bundle = await getFirmProfileBundle(workspaceId);
    return Response.json({ success: true, data: bundle });
  }

  const parsed = patchProfileSchema.parse(body);
  const profile = await db.firmProfile.findFirst({
    where: { workspaceId, deletedAt: null },
  });
  if (!profile) {
    return Response.json({ error: "Profile not found" }, { status: 404 });
  }

  const updated = await db.firmProfile.update({
    where: { id: profile.id },
    data: {
      crdNumber: parsed.crdNumber ?? profile.crdNumber,
      ccoName: parsed.ccoName ?? profile.ccoName,
      advFilingDate: parsed.advFilingDate
        ? new Date(parsed.advFilingDate)
        : parsed.advFilingDate === null
          ? null
          : profile.advFilingDate,
      aumUsd: parsed.aumUsd !== undefined ? parseAum(parsed.aumUsd) : profile.aumUsd,
      advDocumentUrl:
        parsed.advDocumentUrl !== undefined
          ? parsed.advDocumentUrl || null
          : profile.advDocumentUrl,
      riskFlags: parsed.riskFlags ?? profile.riskFlags,
    },
  });

  return Response.json({ success: true, data: { profile: mapFirmProfileDto(updated) } });
}
