/**
 * QStash — Epic 2.2: Upload audit pack ZIP + metadata JSON to Microsoft Graph drive
 */

import { db } from "~/server/db";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { z } from "zod";
import { buildAuditPackZipForMeeting } from "~/server/export/build-audit-pack-for-meeting";
import { getValidAccessTokenForProvider } from "~/server/integrations/token-refresh";
import { uploadDriveItem } from "~/server/integrations/sharepoint/graph-upload";

export const runtime = "nodejs";
export const maxDuration = 120;

const bodySchema = z.object({
  meetingId: z.string(),
  workspaceId: z.string(),
});

type SharePointConfig = {
  driveId?: string;
  rootFolder?: string;
  accountEmail?: string;
};

async function handler(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const { meetingId, workspaceId } = parsed.data;

  const [meeting, credential, intConfig] = await Promise.all([
    db.meeting.findFirst({ where: { id: meetingId, workspaceId } }),
    db.integrationCredential.findUnique({
      where: { workspaceId_provider: { workspaceId, provider: "SHAREPOINT" } },
    }),
    db.integrationConfig.findUnique({
      where: { workspaceId_provider: { workspaceId, provider: "SHAREPOINT" } },
    }),
  ]);

  if (!meeting || meeting.status !== "FINALIZED") {
    return Response.json({ error: "Meeting not found or not finalized" }, { status: 400 });
  }
  if (meeting.sharepointDepositedAt) {
    return Response.json({ ok: true, skipped: "already_deposited" });
  }
  if (!credential || credential.status !== "CONNECTED" || !intConfig) {
    return Response.json({ error: "SharePoint not connected" }, { status: 400 });
  }

  const cfg = (intConfig.config as SharePointConfig) ?? {};
  const driveId = cfg.driveId;
  const rootFolder = (cfg.rootFolder ?? "ComplyVault").replace(/^\/+|\/+$/g, "");
  if (!driveId) {
    return Response.json({ error: "SharePoint drive not configured" }, { status: 400 });
  }

  const accessToken = await getValidAccessTokenForProvider(workspaceId, "SHAREPOINT");
  if (!accessToken) {
    await db.integrationConfig.update({
      where: { id: intConfig.id },
      data: {
        lastErrorAt: new Date(),
        lastErrorMessage: "SharePoint access token unavailable",
      },
    });
    await db.integrationSyncLog.create({
      data: {
        integrationConfigId: intConfig.id,
        meetingId,
        provider: "SHAREPOINT",
        action: "sharepoint_upload",
        status: "failed",
        attempts: 1,
        errorMessage: "access token unavailable",
        completedAt: new Date(),
      },
    });
    return Response.json({ error: "token_unavailable" }, { status: 500 });
  }

  const pack = await buildAuditPackZipForMeeting({
    meetingId,
    workspaceId,
    exportingUserName: "ComplyVault",
  });

  if (!pack.success) {
    await db.integrationSyncLog.create({
      data: {
        integrationConfigId: intConfig.id,
        meetingId,
        provider: "SHAREPOINT",
        action: "sharepoint_upload",
        status: "failed",
        attempts: 1,
        errorMessage: pack.error,
        completedAt: new Date(),
      },
    });
    return Response.json({ error: pack.error }, { status: 400 });
  }

  const d = meeting.meetingDate;
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const folderPath = `${rootFolder}/AuditPacks/${yyyy}/${mm}`;

  const metaName = `${meeting.id}_metadata.json`;
  const meta = {
    meetingId: meeting.id,
    workspaceId,
    clientName: meeting.clientName,
    meetingDate: meeting.meetingDate.toISOString(),
    finalizedAt: meeting.finalizedAt?.toISOString() ?? null,
    depositedAt: new Date().toISOString(),
    source: "complyvault",
  };

  try {
    const zipResult = await uploadDriveItem(
      accessToken,
      driveId,
      `${folderPath}/${pack.filename}`,
      pack.buffer
    );
    await uploadDriveItem(
      accessToken,
      driveId,
      `${folderPath}/${metaName}`,
      Buffer.from(JSON.stringify(meta, null, 2), "utf-8")
    );

    await db.meeting.update({
      where: { id: meetingId },
      data: {
        sharepointItemWebUrl: zipResult.webUrl || null,
        sharepointDepositedAt: new Date(),
      },
    });

    await db.integrationConfig.update({
      where: { id: intConfig.id },
      data: { lastSyncAt: new Date(), lastErrorAt: null, lastErrorMessage: null },
    });

    await db.integrationSyncLog.create({
      data: {
        integrationConfigId: intConfig.id,
        meetingId,
        provider: "SHAREPOINT",
        action: "sharepoint_upload",
        status: "success",
        attempts: 1,
        completedAt: new Date(),
      },
    });

    return Response.json({ ok: true, webUrl: zipResult.webUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "upload failed";
    await db.integrationConfig.update({
      where: { id: intConfig.id },
      data: { lastErrorAt: new Date(), lastErrorMessage: msg },
    });
    await db.integrationSyncLog.create({
      data: {
        integrationConfigId: intConfig.id,
        meetingId,
        provider: "SHAREPOINT",
        action: "sharepoint_upload",
        status: "failed",
        attempts: 1,
        errorMessage: msg,
        completedAt: new Date(),
      },
    });
    console.error("SharePoint deposit failed:", err);
    return Response.json({ error: msg }, { status: 500 });
  }
}

export const POST = (() => {
  const isProduction = process.env.NODE_ENV === "production";
  const hasSigningKeys = !!(
    process.env.QSTASH_CURRENT_SIGNING_KEY || process.env.QSTASH_NEXT_SIGNING_KEY
  );
  if (isProduction && hasSigningKeys) {
    return verifySignatureAppRouter(handler);
  }
  return handler;
})();
