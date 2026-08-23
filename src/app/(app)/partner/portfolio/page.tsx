import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { isRelease1DemoEnabled } from "~/lib/feature-flags";
import { requireAppAccess } from "~/server/auth/guards";
import { assertNoCrossWorkspaceRead } from "~/server/partner/snapshots";
import { listPartnerSnapshotsForUser } from "~/server/partner/resolve-snapshots";

export default async function PartnerPortfolioPage(): Promise<React.JSX.Element> {
  if (!isRelease1DemoEnabled()) redirect("/dashboard");

  const access = await requireAppAccess();
  if (!access.ok) {
    if (access.status === 401) redirect("/auth/signin");
    return <div className="p-6 text-destructive">{access.error}</div>;
  }
  if (access.session.user.role !== "OWNER_CCO") redirect("/dashboard");

  const { tenant, snapshots } = await listPartnerSnapshotsForUser(
    access.session.user.id,
  );
  assertNoCrossWorkspaceRead();
  return (
    <main className="mx-auto max-w-6xl p-6">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Partner Portfolio</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {tenant === "riact"
            ? "Sonoran Compliance Partners — prepared snapshot across three client firms. No live cross-workspace reads."
            : "Named exposure factors across authorised firms. Drill-in is limited to firms you are a member of."}
        </p>
      </header>
      <div className="grid gap-4 lg:grid-cols-3">
        {snapshots.map((snapshot) => (
          <Card key={snapshot.firmId}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>{snapshot.displayName}</CardTitle>
                  <CardDescription className="mt-2">
                    Last ingestion: {snapshot.lastIngestionAt ? new Date(snapshot.lastIngestionAt).toLocaleDateString() : "Unavailable"}
                  </CardDescription>
                </div>
                <Badge variant="outline">{snapshot.coverageCompleteness}% coverage</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-muted-foreground">Overdue items</p><p className="text-lg font-semibold">{snapshot.overdueItems}</p></div>
                <div><p className="text-muted-foreground">Oldest item</p><p className="text-lg font-semibold">{snapshot.oldestItemDays} days</p></div>
              </div>
              <div>
                <p className="font-medium">Exposure factors</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                  {snapshot.contributingFactors.map((factor) => <li key={factor}>{factor}</li>)}
                </ul>
              </div>
              {snapshot.evidenceGaps.length ? (
                <div>
                  <p className="font-medium">Evidence gaps</p>
                  <ul className="mt-2 space-y-1 text-muted-foreground">
                    {snapshot.evidenceGaps.map((gap) => (
                      <li key={`${gap.channel}-${gap.from}`}>{gap.channel}: {gap.detail} ({gap.from}–{gap.to})</li>
                    ))}
                  </ul>
                </div>
              ) : <p className="text-muted-foreground">No snapshot evidence gaps.</p>}
              {snapshot.drillsIntoDemoWorkspace ? (
                <Button size="sm" asChild><Link href="/needs-attention">Open Needs Attention</Link></Button>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
