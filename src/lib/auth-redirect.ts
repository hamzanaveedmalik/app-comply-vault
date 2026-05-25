import { db } from "~/server/db";
import { activeUserWorkspaceWhere } from "~/lib/user-workspace-filters";
import { pathForUserWithoutActiveWorkspace } from "~/server/workspace/no-workspace-redirect";

/** Allow same-origin relative paths only (blocks open redirects). */
export function safeCallbackUrl(raw: string | undefined): string | null {
  if (!raw?.startsWith("/") || raw.startsWith("//")) {
    return null;
  }
  return raw;
}

type ResolvePostAuthRedirectInput = {
  userId: string;
  email: string | null | undefined;
  workspaceId: string | null | undefined;
  callbackUrl?: string;
  fallback?: string;
};

export async function resolvePostAuthRedirect(
  input: ResolvePostAuthRedirectInput,
): Promise<string> {
  const safeCallback = safeCallbackUrl(input.callbackUrl);
  if (safeCallback) {
    return safeCallback;
  }

  if (input.workspaceId && input.workspaceId !== "") {
    return "/dashboard";
  }

  const activeMembership = await db.userWorkspace.findFirst({
    where: { userId: input.userId, ...activeUserWorkspaceWhere },
  });
  if (activeMembership) {
    return "/dashboard";
  }

  const noWorkspacePath = await pathForUserWithoutActiveWorkspace(
    input.userId,
    input.email,
  );
  if (noWorkspacePath !== "/workspaces/new") {
    return noWorkspacePath;
  }

  return input.fallback ?? "/workspaces/new";
}
