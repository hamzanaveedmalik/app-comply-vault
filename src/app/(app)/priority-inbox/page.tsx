import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { redirect } from "next/navigation";
import { PriorityInbox } from "~/components/supervision/priority-inbox";
import { DEFAULT_INBOX_TAB, listPriorityInbox } from "~/server/supervision/inbox";
import { parseSupervisionFilters } from "~/server/supervision/filters";
import { redirectPathForMissingWorkspace } from "~/server/workspace/no-workspace-redirect";

export const dynamic = "force-dynamic";

export default async function PriorityInboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.ReactElement> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }
  if (!session.user.workspaceId || session.user.workspaceId === "") {
    redirect(await redirectPathForMissingWorkspace(session.user.id, session.user.email));
  }

  const params = await searchParams;
  const filters = parseSupervisionFilters(params);
  const focusParam = Array.isArray(params.finding) ? params.finding[0] : params.finding;
  const inbox = await listPriorityInbox(db, {
    userId: session.user.id,
    filters,
    tab: filters.inboxTab ?? DEFAULT_INBOX_TAB,
  });

  return (
    <div className="min-h-0 bg-surface-page px-6 py-6">
      <PriorityInbox inbox={inbox} filters={filters} focusId={focusParam} />
    </div>
  );
}
