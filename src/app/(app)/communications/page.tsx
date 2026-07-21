import { requireAppAccess } from "~/server/auth/guards";
import { redirect } from "next/navigation";
import { listCommunicationThreads } from "~/server/mailbox/threads";
import { countFailedClassifications } from "~/server/classification/status";
import { isEmailIntelligenceEnabled } from "~/lib/feature-flags";
import { CommunicationsClient } from "./communications-client";

export default async function CommunicationsPage() {
  const access = await requireAppAccess();
  if (!access.ok) {
    if (access.status === 401) redirect("/auth/signin");
    return <div className="p-6 text-destructive">{access.error}</div>;
  }

  const threads = await listCommunicationThreads(access.workspaceId);
  const failedClassificationCount = isEmailIntelligenceEnabled()
    ? await countFailedClassifications(access.workspaceId)
    : 0;
  return (
    <CommunicationsClient
      threads={threads}
      failedClassificationCount={failedClassificationCount}
    />
  );
}
