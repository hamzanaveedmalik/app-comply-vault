import type { Session } from "next-auth";
import { requireAuthAndEmailVerified } from "~/server/auth/guards";
import { db } from "~/server/db";
import { redirect } from "next/navigation";
import { AppSidebar } from "~/components/app-sidebar";
import { TopBar } from "~/components/top-bar";
import { listWorkspacesForUser } from "~/server/workspace/list-workspaces-for-user";
import type { WorkspaceListItemDto } from "~/lib/workspace-types";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authCheck = await requireAuthAndEmailVerified();

  if (!authCheck.ok) {
    if (authCheck.status === 401) {
      redirect("/auth/signin");
    }
    redirect(`/auth/signin?error=${encodeURIComponent(authCheck.error)}`);
  }

  const session = authCheck.session as Session;

  let reviewQueueCount = 0;
  let billingStatus: string | null = null;
  let workspaces: WorkspaceListItemDto[] = [];

  if (session.user.workspaceId && session.user.workspaceId !== "") {
    const [workspace, reviewCount, wsList] = await Promise.all([
      db.workspace.findUnique({
        where: { id: session.user.workspaceId },
        select: {
          billingStatus: true,
        },
      }),
      db.meeting.count({
        where: {
          workspaceId: session.user.workspaceId,
          status: { in: ["DRAFT_READY", "DRAFT"] },
        },
      }),
      listWorkspacesForUser(session.user.id),
    ]);
    billingStatus = workspace?.billingStatus ?? null;
    reviewQueueCount = reviewCount;
    workspaces = wsList;
  }

  return (
    <div className="min-h-screen bg-surface-page">
      <AppSidebar
        userEmail={session.user.email}
        userName={session.user.name}
        userRole={session.user.role}
        activeWorkspaceId={session.user.workspaceId ?? ""}
        workspaces={workspaces}
        reviewQueueCount={reviewQueueCount}
      />
      <div className="lg:pl-[244px]">
        <TopBar
          userEmail={session.user.email}
          userName={session.user.name}
          userImage={session.user.image}
          userRole={session.user.role}
          billingStatus={billingStatus}
        />
      </div>
      <main className="min-h-screen pt-14 lg:pl-[244px]">{children}</main>
    </div>
  );
}
