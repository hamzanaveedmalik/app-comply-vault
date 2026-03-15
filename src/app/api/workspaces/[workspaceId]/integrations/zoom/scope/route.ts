/**
 * PATCH /api/workspaces/[workspaceId]/integrations/zoom/scope
 * Epic 1 Story 1.3: Zoom recording scope settings
 */

import { db } from "~/server/db";
import { requireAppAccess } from "~/server/auth/guards";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const scopeSchema = z.object({
  recordingScope: z.enum(["all", "external_only"]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const access = await requireAppAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  if (access.session.user.role !== "OWNER_CCO") {
    return NextResponse.json({ error: "Only workspace owners can update scope" }, { status: 403 });
  }

  const { workspaceId } = await params;
  if (workspaceId !== access.workspaceId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { recordingScope } = scopeSchema.parse(body);

  const config = await db.integrationConfig.findUnique({
    where: {
      workspaceId_provider: { workspaceId, provider: "ZOOM" },
    },
  });

  if (!config) {
    return NextResponse.json({ error: "Zoom not connected" }, { status: 404 });
  }

  const currentConfig = (config.config as Record<string, unknown>) ?? {};
  await db.integrationConfig.update({
    where: { id: config.id },
    data: {
      config: {
        ...currentConfig,
        recordingScope,
      },
    },
  });

  return NextResponse.json({ recordingScope });
}
