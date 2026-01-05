import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { redirect } from "next/navigation";
import { WorkspaceSettingsForm } from "./workspace-settings-form";

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user?.workspaceId) {
    redirect("/workspaces/new");
  }

  // Only OWNER_CCO can access settings
  if (session.user.role !== "OWNER_CCO") {
    redirect("/dashboard");
  }

  const workspace = await db.workspace.findUnique({
    where: { id: session.user.workspaceId },
  });

  if (!workspace) {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Workspace Settings</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage your workspace configuration and preferences
          </p>
        </div>

        <WorkspaceSettingsForm workspace={workspace} />
      </div>
  );
}


