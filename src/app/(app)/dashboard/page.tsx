import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { redirect } from "next/navigation";
import { buildDashboardSummary } from "~/server/dashboard/build-dashboard-summary";
import { DashboardView } from "~/components/dashboard/dashboard-view";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.workspaceId || session.user.workspaceId === "") {
    redirect("/workspaces/new");
  }

  const summary = await buildDashboardSummary(db, session.user.workspaceId);

  return (
    <div className="min-h-0 bg-surface-page px-6 py-6">
      <DashboardView summary={summary} />
    </div>
  );
}
