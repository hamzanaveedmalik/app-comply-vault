/**
 * PATCH — update SharePoint root folder label (path prefix before /AuditPacks/YYYY/MM)
 */

import { requireAppAccess } from "~/server/auth/guards";
import { db } from "~/server/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const patchSchema = z.object({
  rootFolder: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-zA-Z0-9 _\-./]+$/u, "Use letters, numbers, spaces, and simple punctuation only"),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
): Promise<Response> {
  const access = await requireAppAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  if (access.session.user.role !== "OWNER_CCO") {
    return NextResponse.json({ error: "Only workspace owners can update this" }, { status: 403 });
  }

  const { workspaceId } = await params;
  if (workspaceId !== access.workspaceId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const configRow = await db.integrationConfig.findUnique({
    where: { workspaceId_provider: { workspaceId, provider: "SHAREPOINT" } },
  });
  if (!configRow) {
    return NextResponse.json({ error: "SharePoint not connected" }, { status: 404 });
  }

  const body = await request.json();
  const { rootFolder } = patchSchema.parse(body);
  const normalized = rootFolder.replace(/^\/+|\/+$/g, "").replace(/\/\/+/g, "/");

  const existing = (configRow.config as Record<string, unknown>) ?? {};
  await db.integrationConfig.update({
    where: { id: configRow.id },
    data: {
      config: { ...existing, rootFolder: normalized },
    },
  });

  return NextResponse.json({ success: true, data: { rootFolder: normalized } });
}
