import { auth } from "~/server/auth";
import { redirect } from "next/navigation";
import { ComplianceCockpitClient } from "~/components/compliance-cockpit/ComplianceCockpitClient";
import { getFirmProfileBundle } from "~/server/firm-profile/get-firm-profile";
import {
  canWriteCockpit,
  getWorkspaceMembership,
} from "~/server/firm-profile/workspace-access";
import { redirectPathForMissingWorkspace } from "~/server/workspace/no-workspace-redirect";

export default async function ComplianceCockpitPage(): Promise<React.ReactElement> {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  if (!session.user.workspaceId || session.user.workspaceId === "") {
    redirect(
      await redirectPathForMissingWorkspace(session.user.id, session.user.email),
    );
  }

  const workspaceId = session.user.workspaceId;
  const access = await getWorkspaceMembership(session.user.id, workspaceId);

  if (!access.ok) {
    if (access.status === 403) {
      return (
        <div className="flex min-h-[50vh] items-center justify-center p-6">
          <div className="text-center">
            <h1 className="text-lg font-semibold text-text-primary">Access denied</h1>
            <p className="mt-2 text-sm text-text-secondary">
              The Compliance Cockpit is not available for advisor accounts.
            </p>
          </div>
        </div>
      );
    }
    redirect("/dashboard");
  }

  const bundle = await getFirmProfileBundle(workspaceId);

  return (
    <ComplianceCockpitClient
      {...bundle}
      workspaceId={workspaceId}
      canWrite={canWriteCockpit(access.role)}
    />
  );
}
