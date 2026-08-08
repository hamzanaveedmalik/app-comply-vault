import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { redirect } from "next/navigation";
import { SupervisionCommandCentre } from "~/components/supervision/supervision-command-centre";
import { parseSupervisionFilters } from "~/server/supervision/filters";
import { getPortfolioSupervisionSummary } from "~/server/supervision/portfolio";
import { redirectPathForMissingWorkspace } from "~/server/workspace/no-workspace-redirect";

export const dynamic = "force-dynamic";

export default async function SupervisionPage({
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

  const filters = parseSupervisionFilters(await searchParams);
  const portfolio = await getPortfolioSupervisionSummary(db, session.user.id, filters);

  return (
    <div className="min-h-0 bg-surface-page px-6 py-6">
      <SupervisionCommandCentre portfolio={portfolio} filters={filters} />
    </div>
  );
}
