import type { ReactElement } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAppAccess } from "~/server/auth/guards";
import { loadZohoActivity, type ZohoActivityScope } from "~/server/integrations/zoho/list-activities";
import { ZohoActivityClient } from "./zoho-activity-client";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";

export const dynamic = "force-dynamic";

function parseScope(value: string | string[] | undefined): ZohoActivityScope {
  return value === "all" ? "all" : "mine";
}

export default async function ZohoActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<ReactElement> {
  const params = await searchParams;
  const access = await requireAppAccess();
  if (!access.ok) {
    if (access.status === 401) redirect("/auth/signin");
    return (
      <div className="p-6">
        <p className="text-destructive">{access.error}</p>
      </div>
    );
  }

  const scope = parseScope(params.scope);
  const currentUserEmail = access.session.user.email ?? null;

  const result = await loadZohoActivity({
    workspaceId: access.workspaceId,
    scope,
    currentUserEmail,
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Zoho CRM</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Open tasks and upcoming meetings from your connected Zoho CRM org.
          </p>
        </div>
        <Link
          href="/integrations"
          className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          Back to Integrations
        </Link>
      </div>

      {result.state === "not_connected" && (
        <Alert>
          <AlertTitle>Zoho CRM is not connected</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              Connect Zoho CRM from the Integrations page to see your open tasks
              and upcoming meetings here.
            </p>
            <Button asChild size="sm">
              <Link href="/integrations">Go to Integrations</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {result.state === "reconnect_required" && (
        <Alert variant="destructive">
          <AlertTitle>Reconnect Zoho CRM to enable Tasks &amp; Meetings</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              Your existing Zoho connection was authorized before Tasks and
              Meetings read access was added. Disconnect and reconnect to
              grant the new permissions:
            </p>
            <ul className="list-disc pl-5 text-xs font-mono">
              {result.missingScopes.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <Button asChild size="sm">
              <Link href="/integrations">Reconnect on Integrations</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {result.state === "error" && (
        <Alert variant="destructive">
          <AlertTitle>Could not load Zoho activity</AlertTitle>
          <AlertDescription>{result.message}</AlertDescription>
        </Alert>
      )}

      {result.state === "ok" && (
        <ZohoActivityClient
          tasks={result.tasks}
          meetings={result.meetings}
          scope={result.scope}
          fetchedAtIso={result.fetchedAtIso}
          filterEmail={result.filterEmail}
          currentUserEmail={currentUserEmail}
        />
      )}
    </div>
  );
}
