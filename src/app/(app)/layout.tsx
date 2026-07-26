import type { Session } from "next-auth";
import { requireAuthAndEmailVerified } from "~/server/auth/guards";
import { db } from "~/server/db";
import { redirect } from "next/navigation";
import { AppSidebar } from "~/components/app-sidebar";
import { AppShell } from "~/components/layout/app-shell";
import { MediaPostureBanner } from "~/components/layout/media-posture-banner";
import { RetentionAnchoringBanner } from "~/components/layout/retention-anchoring-banner";
import { TopBar } from "~/components/top-bar";
import { listWorkspacesForUser } from "~/server/workspace/list-workspaces-for-user";
import type { WorkspaceListItemDto } from "~/lib/workspace-types";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

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
  let mediaPostureUnset = false;
  let retentionNotice: {
    fiscalYearEndLabel: string;
    retentionYears: number;
  } | null = null;

  if (session.user.workspaceId && session.user.workspaceId !== "") {
    const [workspace, reviewCount, wsList] = await Promise.all([
      db.workspace.findUnique({
        where: { id: session.user.workspaceId },
        select: {
          billingStatus: true,
          mediaPosture: true,
          retentionAnchoringNoticePending: true,
          retentionYears: true,
          fiscalYearEndMonth: true,
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
    mediaPostureUnset = workspace ? workspace.mediaPosture === null : false;
    reviewQueueCount = reviewCount;
    workspaces = wsList;

    if (
      workspace?.retentionAnchoringNoticePending &&
      session.user.role === "OWNER_CCO"
    ) {
      const monthIndex = Math.min(Math.max(workspace.fiscalYearEndMonth, 1), 12) - 1;
      retentionNotice = {
        fiscalYearEndLabel: MONTH_NAMES[monthIndex] ?? "December",
        retentionYears: workspace.retentionYears,
      };
    }
  }

  return (
    <div className="min-h-screen bg-surface-page">
      <AppShell
        sidebar={
          <AppSidebar
            userEmail={session.user.email}
            userName={session.user.name}
            userRole={session.user.role}
            activeWorkspaceId={session.user.workspaceId ?? ""}
            workspaces={workspaces}
            reviewQueueCount={reviewQueueCount}
          />
        }
        topBar={
          <TopBar
            userEmail={session.user.email}
            userName={session.user.name}
            userImage={session.user.image}
            userRole={session.user.role}
            billingStatus={billingStatus}
          />
        }
      >
        {retentionNotice && session.user.workspaceId && (
          <RetentionAnchoringBanner
            workspaceId={session.user.workspaceId}
            fiscalYearEndLabel={retentionNotice.fiscalYearEndLabel}
            retentionYears={retentionNotice.retentionYears}
          />
        )}
        {mediaPostureUnset && (
          <MediaPostureBanner isCco={session.user.role === "OWNER_CCO"} />
        )}
        {children}
      </AppShell>
    </div>
  );
}
