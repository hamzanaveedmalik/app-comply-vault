import type { Session } from "next-auth";
import { requireAuthAndEmailVerified } from "~/server/auth/guards";
import { db } from "~/server/db";
import { redirect } from "next/navigation";
import { AppSidebar } from "~/components/app-sidebar";
import { TopBar } from "~/components/top-bar";

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
  let workspaceName: string | null = null;
  let workspaceMemberCount = 0;
  let billingStatus: string | null = null;

  if (session.user.workspaceId && session.user.workspaceId !== "") {
    const [workspace, reviewCount] = await Promise.all([
      db.workspace.findUnique({
        where: { id: session.user.workspaceId },
        select: {
          name: true,
          billingStatus: true,
          _count: { select: { users: true } },
        },
      }),
      db.meeting.count({
        where: {
          workspaceId: session.user.workspaceId,
          status: { in: ["DRAFT_READY", "DRAFT"] },
        },
      }),
    ]);
    workspaceName = workspace?.name ?? null;
    workspaceMemberCount = workspace?._count.users ?? 0;
    billingStatus = workspace?.billingStatus ?? null;
    reviewQueueCount = reviewCount;
  }

  return (
    <div className="min-h-screen bg-surface-page">
      <AppSidebar
        userEmail={session.user.email}
        userName={session.user.name}
        userRole={session.user.role}
        workspaceName={workspaceName}
        workspaceMemberCount={workspaceMemberCount}
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
