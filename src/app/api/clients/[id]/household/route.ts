/**
 * Household + email alias mutations for a client.
 */

import { z } from "zod";
import { requireAppAccess } from "~/server/auth/guards";
import { isComplianceActor } from "~/lib/meeting-workflow";
import { isEmailIntelligenceEnabled } from "~/lib/feature-flags";
import {
  addClientEmailAlias,
  createHouseholdMember,
  linkClientToHousehold,
  previewAliasHistoricalThreads,
  removeClientEmailAlias,
  removeHouseholdMember,
  updateHouseholdMemberRole,
} from "~/server/clients/household";

const roleSchema = z.enum(["PRIMARY", "SPOUSE", "JOINT"]);

async function requireHouseholdEdit(): Promise<
  | { ok: true; workspaceId: string; userId: string }
  | { ok: false; response: Response }
> {
  if (!isEmailIntelligenceEnabled()) {
    return {
      ok: false,
      response: Response.json({ success: false, error: "Feature disabled" }, { status: 404 }),
    };
  }
  const access = await requireAppAccess();
  if (!access.ok) {
    return {
      ok: false,
      response: Response.json(
        { success: false, error: access.error },
        { status: access.status }
      ),
    };
  }
  if (!isComplianceActor(access.session.user.role)) {
    return {
      ok: false,
      response: Response.json({ success: false, error: "Forbidden" }, { status: 403 }),
    };
  }
  return {
    ok: true,
    workspaceId: access.workspaceId,
    userId: access.session.user.id,
  };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await requireHouseholdEdit();
  if (!auth.ok) return auth.response;

  const { id: clientId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = z
    .discriminatedUnion("action", [
      z.object({
        action: z.literal("link_member"),
        peerClientId: z.string().min(1),
        role: roleSchema,
      }),
      z.object({
        action: z.literal("create_member"),
        name: z.string().min(1),
        role: roleSchema,
      }),
      z.object({
        action: z.literal("update_role"),
        membershipId: z.string().min(1),
        role: roleSchema,
      }),
      z.object({
        action: z.literal("remove_member"),
        membershipId: z.string().min(1),
      }),
      z.object({
        action: z.literal("preview_alias"),
        address: z.string().email(),
      }),
      z.object({
        action: z.literal("add_alias"),
        address: z.string().email(),
        targetClientId: z.string().min(1).optional(),
      }),
      z.object({
        action: z.literal("remove_alias"),
        aliasId: z.string().min(1),
      }),
    ])
    .safeParse(body);

  if (!parsed.success) {
    return Response.json({ success: false, error: "Invalid body" }, { status: 400 });
  }

  const input = parsed.data;

  if (input.action === "link_member") {
    const result = await linkClientToHousehold({
      workspaceId: auth.workspaceId,
      anchorClientId: clientId,
      peerClientId: input.peerClientId,
      role: input.role,
      userId: auth.userId,
    });
    if (!result.success) {
      return Response.json({ success: false, error: result.error }, { status: 400 });
    }
    return Response.json({ success: true, data: result });
  }

  if (input.action === "create_member") {
    const result = await createHouseholdMember({
      workspaceId: auth.workspaceId,
      anchorClientId: clientId,
      name: input.name,
      role: input.role,
      userId: auth.userId,
    });
    if (!result.success) {
      return Response.json({ success: false, error: result.error }, { status: 400 });
    }
    return Response.json({ success: true, data: result });
  }

  if (input.action === "update_role") {
    const result = await updateHouseholdMemberRole({
      workspaceId: auth.workspaceId,
      membershipId: input.membershipId,
      role: input.role,
      userId: auth.userId,
    });
    if (!result.success) {
      return Response.json({ success: false, error: result.error }, { status: 400 });
    }
    return Response.json({ success: true });
  }

  if (input.action === "remove_member") {
    const result = await removeHouseholdMember({
      workspaceId: auth.workspaceId,
      membershipId: input.membershipId,
      userId: auth.userId,
    });
    if (!result.success) {
      return Response.json({ success: false, error: result.error }, { status: 400 });
    }
    return Response.json({ success: true });
  }

  if (input.action === "preview_alias") {
    const count = await previewAliasHistoricalThreads({
      workspaceId: auth.workspaceId,
      address: input.address,
    });
    return Response.json({ success: true, data: { historicalThreadCount: count } });
  }

  if (input.action === "add_alias") {
    const result = await addClientEmailAlias({
      workspaceId: auth.workspaceId,
      clientId: input.targetClientId ?? clientId,
      address: input.address,
      userId: auth.userId,
    });
    if (!result.success) {
      return Response.json({ success: false, error: result.error }, { status: 400 });
    }
    return Response.json({ success: true, data: result.data });
  }

  if (input.action === "remove_alias") {
    const result = await removeClientEmailAlias({
      workspaceId: auth.workspaceId,
      aliasId: input.aliasId,
      userId: auth.userId,
    });
    if (!result.success) {
      return Response.json({ success: false, error: result.error }, { status: 400 });
    }
    return Response.json({ success: true });
  }

  return Response.json({ success: false, error: "Unknown action" }, { status: 400 });
}
