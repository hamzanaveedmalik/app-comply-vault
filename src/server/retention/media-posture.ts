/**
 * CV-TR-06 / CV-TR-06a — Media posture as a forced decision.
 *
 * Scope: meeting source media only (`Meeting.fileUrl` and its storage object).
 * Mailbox MIME retention (EPIC-C) is governed separately and is NOT gated here.
 *
 * A workspace with `mediaPosture = null` has made no documented policy decision,
 * so ingest is blocked rather than defaulted. Blocking happens before any Meeting
 * row is written so a parked ingest never leaves a partial record behind.
 */

import type { MediaPosture, WorkspaceRole } from "../../../generated/prisma";
import { db } from "~/server/db";

export type MediaPostureGate =
  | { ok: true; posture: MediaPosture }
  | { ok: false; status: number; error: string };

export const POSTURE_REQUIRED_MESSAGE =
  "Ingest is blocked until the workspace CCO records a source media retention decision.";

/**
 * Fail-closed gate. Call before creating a Meeting or downloading media.
 */
export async function assertMediaPostureSet(
  workspaceId: string,
): Promise<MediaPostureGate> {
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { mediaPosture: true },
  });

  if (!workspace) {
    return { ok: false, status: 404, error: "Workspace not found" };
  }

  if (!workspace.mediaPosture) {
    return { ok: false, status: 409, error: POSTURE_REQUIRED_MESSAGE };
  }

  return { ok: true, posture: workspace.mediaPosture };
}

export type PostureState = {
  posture: MediaPosture | null;
  postureSetAt: Date | null;
  postureSetById: string | null;
  ingestBlocked: boolean;
};

export async function getMediaPostureState(
  workspaceId: string,
): Promise<PostureState | null> {
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { mediaPosture: true, postureSetAt: true, postureSetById: true },
  });

  if (!workspace) return null;

  return {
    posture: workspace.mediaPosture,
    postureSetAt: workspace.postureSetAt,
    postureSetById: workspace.postureSetById,
    ingestBlocked: !workspace.mediaPosture,
  };
}

export type SetPostureResult =
  | { success: true; data: { posture: MediaPosture; postureSetAt: Date } }
  | { success: false; error: string; status: number };

/**
 * Only OWNER_CCO may set posture. Changes apply to future ingests only;
 * media already discarded is unrecoverable.
 */
export async function setMediaPosture(args: {
  workspaceId: string;
  userId: string;
  actorRole: WorkspaceRole | null | undefined;
  posture: MediaPosture;
}): Promise<SetPostureResult> {
  if (args.actorRole !== "OWNER_CCO") {
    return {
      success: false,
      status: 403,
      error: "Only the workspace CCO can set the source media retention policy.",
    };
  }

  const workspace = await db.workspace.findUnique({
    where: { id: args.workspaceId },
    select: { mediaPosture: true },
  });

  if (!workspace) {
    return { success: false, status: 404, error: "Workspace not found" };
  }

  const previous = workspace.mediaPosture;
  const setAt = new Date();

  await db.$transaction(async (tx) => {
    await tx.workspace.update({
      where: { id: args.workspaceId },
      data: {
        mediaPosture: args.posture,
        postureSetById: args.userId,
        postureSetAt: setAt,
      },
    });

    await tx.auditEvent.create({
      data: {
        workspaceId: args.workspaceId,
        userId: args.userId,
        action: "MEDIA_POSTURE_SET",
        resourceType: "workspace",
        resourceId: args.workspaceId,
        metadata: {
          previousPosture: previous,
          newPosture: args.posture,
          setAt: setAt.toISOString(),
          note:
            previous === "DISCARD" && args.posture === "RETAIN"
              ? "Applies to future ingests only. Previously discarded media is unrecoverable."
              : "Applies to future ingests only.",
        },
      },
    });
  });

  return { success: true, data: { posture: args.posture, postureSetAt: setAt } };
}
