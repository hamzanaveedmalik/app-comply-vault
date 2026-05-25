import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { redirect } from "next/navigation";
import { buildDashboardSummary } from "~/server/dashboard/build-dashboard-summary";
import { DashboardView } from "~/components/dashboard/dashboard-view";
import { WelcomeBanner } from "./components/welcome-banner";
import type { WorkspaceRoleKey } from "~/lib/role-config";

export default async function DashboardPage(): Promise<React.ReactElement> {
  const session = await auth();

  if (!session?.user?.workspaceId || session.user.workspaceId === "") {
    redirect("/workspaces/new");
  }

  const workspaceId = session.user.workspaceId;

  const [summary, membership, workspace, inviteAccepted] = await Promise.all([
    buildDashboardSummary(db, workspaceId),
    db.userWorkspace.findUnique({
      where: {
        userId_workspaceId: {
          userId: session.user.id,
          workspaceId,
        },
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
      <DashboardView summary={summary} />
    </div>
  );
}
