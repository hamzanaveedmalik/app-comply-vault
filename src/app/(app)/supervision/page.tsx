import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { redirect } from "next/navigation";
import { SupervisionCommandCentre } from "~/components/supervision/supervision-command-centre";
import { getPortfolioSupervisionSummary } from "~/server/supervision/portfolio";
import { redirectPathForMissingWorkspace } from "~/server/workspace/no-workspace-redirect";

export const dynamic = "force-dynamic";

export default async function SupervisionPage({
  searchParams,
}: {
  searchParams: Promise<{ firmId?: string | string[] }>;
}): Promise<React.ReactElement> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }
  if (!session.user.workspaceId || session.user.workspaceId === "") {
    redirect(await redirectPathForMissingWorkspace(session.user.id, session.user.email));
  }

  const rawFirm = (await searchParams).firmId;
  const firmId = typeof rawFirm === "string" && rawFirm.length > 0 ? rawFirm : undefined;

  const portfolio = await getPortfolioSupervisionSummary(db, session.user.id, {
    firmId,
  });

  return (
    <div className="min-h-0 bg-surface-page px-6 py-6">
      <SupervisionCommandCentre portfolio={portfolio} />
    </div>
  );
}
