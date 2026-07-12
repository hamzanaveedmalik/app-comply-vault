import { requireAppAccess } from "~/server/auth/guards";
import { redirect, notFound } from "next/navigation";
import { getThreadDetail } from "~/server/mailbox/threads";
import { ThreadReaderClient } from "./thread-reader-client";

export default async function ThreadReaderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const access = await requireAppAccess();
  if (!access.ok) {
    if (access.status === 401) redirect("/auth/signin");
    return <div className="p-6 text-destructive">{access.error}</div>;
  }

  const { id } = await params;
  const detail = await getThreadDetail({
    workspaceId: access.workspaceId,
    threadId: id,
  });
  if (!detail) notFound();

  return (
    <ThreadReaderClient thread={detail.thread} messages={detail.messages} />
  );
}
