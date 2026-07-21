import { requireAppAccess } from "~/server/auth/guards";
import { redirect } from "next/navigation";
import { GmailMailClient } from "./gmail-mail-client";
import { getWorkspaceGmailStatus } from "~/server/mailbox/status";

export default async function GmailMailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await requireAppAccess();
  if (!access.ok) {
    if (access.status === 401) redirect("/auth/signin");
    return <div className="p-6 text-destructive">{access.error}</div>;
  }
  if (access.session.user.role !== "OWNER_CCO") {
    return (
      <div className="p-6 text-destructive">
        Only workspace owners can manage mailbox connections.
      </div>
    );
  }

  const params = await searchParams;
  const str = (k: string): string | undefined => {
    const v = params[k];
    return typeof v === "string" ? v : undefined;
  };

  const workspaceStatus = await getWorkspaceGmailStatus(access.workspaceId);

  return (
    <GmailMailClient
      workspaceStatus={workspaceStatus}
      connected={str("connected") === "1"}
      mailbox={str("mailbox")}
      error={str("error")}
    />
  );
}
