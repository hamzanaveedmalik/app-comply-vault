import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { listAuthorisedFirmWorkspaceIds } from "~/server/supervision/portfolio";
import { listSupervisoryInteractions } from "~/server/supervision/service";
import { ADVIZORSTACK_PRIMARY_FINDING } from "~/server/supervision/advizorstack-tenant";
import { redirectPathForMissingWorkspace } from "~/server/workspace/no-workspace-redirect";

export const dynamic = "force-dynamic";

/**
 * Minimal Priority Inbox bridge for CV-SI-004 links.
 * Full queue UX is CV-SI-006.
 */
export default async function PriorityInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ finding?: string | string[]; control?: string | string[] }>;
}): Promise<React.ReactElement> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }
  if (!session.user.workspaceId || session.user.workspaceId === "") {
    redirect(await redirectPathForMissingWorkspace(session.user.id, session.user.email));
  }

  const params = await searchParams;
  const findingId =
    typeof params.finding === "string" ? params.finding : ADVIZORSTACK_PRIMARY_FINDING.flagId;
  const control = typeof params.control === "string" ? params.control : undefined;

  const firmIds = await listAuthorisedFirmWorkspaceIds(db, session.user.id);
  const workspaceIds = firmIds.length > 0 ? firmIds : [session.user.workspaceId];

  const batches = await Promise.all(
    workspaceIds.map((workspaceId) =>
      listSupervisoryInteractions(db, workspaceId, {
        outcome: "ESCALATED",
        control,
      }),
    ),
  );
  const items = batches.flat();

  return (
    <div className="min-h-0 bg-surface-page px-6 py-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <Link href="/supervision" className="text-[12.5px] font-medium text-[#177a4c] hover:underline">
          ← Command Centre
        </Link>
        <h1 className="text-[22px] font-semibold text-[#141f19]">CCO Priority Inbox</h1>
        <p className="text-[13px] text-[#5f6b64]">
          Escalated interactions requiring human judgment. Full tabbed inbox is CV-SI-006.
          Focus finding: <code className="text-[12px]">{findingId}</code>
        </p>
        {items.length === 0 ? (
          <div className="rounded-[12px] border border-dashed border-[#d7dbd7] bg-white px-4 py-8 text-center text-[13px] text-[#79837d]">
            No escalated interactions in authorised firms.
          </div>
        ) : (
          <ul className="divide-y divide-[#eef0ee] rounded-[12px] border border-[#e6e8e6] bg-white">
            {items.map((item) => (
              <li key={`${item.channel}-${item.id}`} className="px-4 py-3">
                <Link href={item.href} className="block hover:bg-[#fafbfa]">
                  <p className="text-[13px] font-medium text-[#141f19]">{item.title}</p>
                  <p className="mt-1 text-[12.5px] text-[#5f6b64]">
                    {item.outcomeReason ?? "Escalated for human review"}
                  </p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.04em] text-[#79837d]">
                    {item.primaryControlId ?? "control pending"} · {item.channel}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
