import { auth } from "~/server/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function AuditPacksPage() {
  const session = await auth();
  if (!session?.user?.workspaceId || session.user.workspaceId === "") {
    redirect("/workspaces/new");
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-text-primary">Audit packs</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-text-secondary">
        SEC-ready audit packs are generated when you export a finalized meeting. Open any meeting, then use
        the export action to download the pack. Completed exports appear in your audit trail.
      </p>
      <ul className="mt-6 space-y-3 text-[14px] text-brand">
        <li>
          <Link href="/interaction-log" className="font-semibold hover:underline">
            Interaction log →
          </Link>
        </li>
        {session.user.role === "OWNER_CCO" ? (
          <li>
            <Link href="/audit-logs?action=EXPORT" className="font-semibold hover:underline">
              Audit logs (exports) →
            </Link>
          </li>
        ) : null}
      </ul>
    </div>
  );
}
