/**
 * POST /api/workspaces/[workspaceId]/integrations/[credentialId]/disconnect
 * Epic 6 Story 6.6: Disconnect & Delete — purge tokens, config, cancel jobs
 */

import { requireAppAccess } from "~/server/auth/guards";
import { db } from "~/server/db";
import { sendIntegrationDisconnectEmail } from "~/server/email";
import { activeUserWorkspaceWhere } from "~/lib/user-workspace-filters";
import { zoomAdapter } from "~/server/integrations/adapters/zoom";
import { teamsAdapter } from "~/server/integrations/adapters/teams";
import { sharepointAdapter } from "~/server/integrations/adapters/sharepoint";
import { zohoCrmAdapter } from "~/server/integrations/adapters/zoho-crm";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string; credentialId: string }> }
) {
  const access = await requireAppAccess();
  if (!access.ok) {
    return new Response(access.error, { status: access.status });
  }

  const { workspaceId, credentialId } = await params;
  if (workspaceId !== access.workspaceId) {
    return new Response("Forbidden", { status: 403 });
  }

  if (access.session.user.role !== "OWNER_CCO") {
    return new Response("Forbidden: Only workspace owners can disconnect integrations", {
      status: 403,
    });
  }

  const credential = await db.integrationCredential.findFirst({
    where: { id: credentialId, workspaceId },
    include: { workspace: { select: { name: true } } },
  });

  if (!credential) {
    return new Response("Integration not found", { status: 404 });
  }

  if (credential.provider === "ZOOM") {
    await zoomAdapter.disconnect({ workspaceId });
  } else if (credential.provider === "TEAMS") {
    await teamsAdapter.disconnect({ workspaceId });
  } else if (credential.provider === "SHAREPOINT") {
    await sharepointAdapter.disconnect({ workspaceId });
  } else if (credential.provider === "ZOHO_CRM") {
    await zohoCrmAdapter.disconnect({ workspaceId });
  } else {
    await db.integrationCredential.delete({ where: { id: credentialId } });
    await db.integrationConfig.deleteMany({
      where: { workspaceId, provider: credential.provider },
    });
  }

  const owner = await db.userWorkspace.findFirst({
    where: { workspaceId, role: "OWNER_CCO", ...activeUserWorkspaceWhere },
    include: { user: { select: { email: true } } },
  });
  if (owner?.user?.email) {
    await sendIntegrationDisconnectEmail({
      email: owner.user.email,
      workspaceName: credential.workspace.name,
      provider: credential.provider,
    });
  }

  return Response.json({ success: true });
}
