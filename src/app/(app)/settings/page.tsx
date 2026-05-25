import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { WorkspaceSettingsForm } from "./workspace-settings-form";
import { redirectPathForMissingWorkspace } from "~/server/workspace/no-workspace-redirect";
import { activeUserWorkspaceWhere } from "~/lib/user-workspace-filters";

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user?.workspaceId) {
    if (!session?.user) {
      redirect("/auth/signin");
    }
    redirect(
      await redirectPathForMissingWorkspace(session.user.id, session.user.email),
    );
  }

  // Only OWNER_CCO can access settings
  if (session.user.role !== "OWNER_CCO") {
    redirect("/dashboard");
  }

  const workspace = await db.workspace.findUnique({
    where: { id: session.user.workspaceId },
  });

  const members = await db.userWorkspace.findMany({
    where: { workspaceId: session.user.workspaceId, ...activeUserWorkspaceWhere },
    include: {
      user: true,
    },
    orderBy: [
      { role: "asc" },
      { user: { name: "asc" } },
      { user: { email: "asc" } },
    ],
  });

  if (!workspace) {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Workspace Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage your workspace configuration and preferences
        </p>
      </div>

      <WorkspaceSettingsForm
        workspace={workspace}
        members={members.map((member) => ({
          userId: member.userId,
          role: member.role,
          name: member.user.name,
          email: member.user.email,
        }))}
        currentUserId={session.user.id}
      />
    </div>
  );
}


