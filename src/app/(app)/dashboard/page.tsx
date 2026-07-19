import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { redirect } from "next/navigation";
import { buildDashboardSummary } from "~/server/dashboard/build-dashboard-summary";
import { DashboardView } from "~/components/dashboard/dashboard-view";
import { WelcomeBanner } from "./components/welcome-banner";
import type { WorkspaceRoleKey } from "~/lib/role-config";
import { redirectPathForMissingWorkspace } from "~/server/workspace/no-workspace-redirect";
import { activeUserWorkspaceWhere } from "~/lib/user-workspace-filters";
import { isDashboardRange, type DashboardRange } from "~/lib/dashboard-types";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string | string[] }>;
}): Promise<React.ReactElement> {
  const session = await auth();

  if (!session?.user?.workspaceId || session.user.workspaceId === "") {
    if (!session?.user) {
      redirect("/auth/signin");
    }
    redirect(
      await redirectPathForMissingWorkspace(session.user.id, session.user.email),
    );
  }

  const workspaceId = session.user.workspaceId;

  const rawRange = (await searchParams).range;
  const range: DashboardRange = isDashboardRange(rawRange) ? rawRange : "90d";

  const [summary, membership, workspace, inviteAccepted] = await Promise.all([
    buildDashboardSummary(db, workspaceId, range),
    db.userWorkspace.findFirst({
      where: {
        userId: session.user.id,
        workspaceId,
        ...activeUserWorkspaceWhere,
      },
      select: { onboardingDismissedAt: true, role: true },
    }),
    db.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    }),
    db.auditEvent.findFirst({
      where: {
        workspaceId,
        userId: session.user.id,
        action: "INVITE_ACCEPTED",
      },
      select: { id: true },
    }),
  ]);

  const showWelcomeBanner =
    membership != null &&
    membership.onboardingDismissedAt == null &&
    inviteAccepted != null;

  return (
    <div className="min-h-0 bg-surface-page px-6 py-6">
      {showWelcomeBanner && workspace && membership ? (
        <WelcomeBanner
          workspaceId={workspaceId}
          workspaceName={workspace.name}
          role={membership.role as WorkspaceRoleKey}
        />
      ) : null}
      <DashboardView summary={summary} workspaceName={workspace?.name ?? "Your workspace"} />
    </div>
  );
}
