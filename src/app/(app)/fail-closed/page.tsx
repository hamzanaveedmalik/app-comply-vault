import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { isRelease1DemoEnabled } from "~/lib/feature-flags";
import { requireAppAccess } from "~/server/auth/guards";
import { getRefusalSurface } from "~/server/retention/refusal-surface";

export default async function FailClosedPage(): Promise<React.JSX.Element> {
  if (!isRelease1DemoEnabled()) redirect("/dashboard");

  const access = await requireAppAccess();
  if (!access.ok) {
    if (access.status === 401) redirect("/auth/signin");
    return <div className="p-6 text-destructive">{access.error}</div>;
  }
  if (access.session.user.role !== "OWNER_CCO") redirect("/dashboard");

  const surface = await getRefusalSurface({ workspaceId: access.workspaceId });
  if (!surface) notFound();

  return (
    <main className="mx-auto max-w-4xl p-6">
      <header className="mb-6">
        <p className="text-sm font-medium text-brand">Release 1 demo</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Fail-closed ingestion</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The record is parked until its protected media posture is decided.
        </p>
      </header>
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Ingestion refused</CardTitle>
                <CardDescription>{surface.reason}</CardDescription>
              </div>
              <Badge variant="destructive">parked: true</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm md:grid-cols-2">
            <div><p className="font-medium">Source</p><p className="text-muted-foreground">{surface.parked.source}</p></div>
            <div><p className="font-medium">Parked at</p><p className="text-muted-foreground">{new Date(surface.parked.parkedAt).toLocaleString()}</p></div>
            <div className="md:col-span-2"><p className="font-medium">Retention rule protected</p><p className="text-muted-foreground">{surface.retentionRuleProtected}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Stored audit event</CardTitle>
            <CardDescription>This is the persisted event for the refusal path.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs text-foreground">
              {JSON.stringify(surface.auditEvent, null, 2)}
            </pre>
          </CardContent>
        </Card>
        <Button asChild>
          <Link href={surface.recoveryPath}>Open recovery path</Link>
        </Button>
      </div>
    </main>
  );
}
