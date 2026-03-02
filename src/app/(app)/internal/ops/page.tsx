/**
 * Internal Ops Dashboard — Epic 6 Story 6.8
 * Per-integration queue depth, jobs processed/failed, failure rate, last 50 failed jobs
 * Auth-gated by OPS_ALLOWED_EMAILS
 */

import { auth } from "~/server/auth";
import { redirect } from "next/navigation";
import { env } from "~/env";
import { getOpsStats } from "~/server/integrations/ops-stats";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { AlertTriangle } from "lucide-react";

function isOpsAllowed(email: string | null | undefined): boolean {
  const allowed = env.OPS_ALLOWED_EMAILS;
  if (!allowed?.trim()) return false;
  const emails = allowed.split(",").map((e) => e.trim().toLowerCase());
  return email ? emails.includes(email.toLowerCase()) : false;
}

export default async function InternalOpsPage() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/auth/signin");
  }

  if (!isOpsAllowed(session.user.email)) {
    return (
      <div className="container max-w-2xl py-12">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              You do not have permission to view the Internal Ops Dashboard.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = await getOpsStats();

  return (
    <div className="container max-w-6xl py-8">
      <h1 className="text-2xl font-semibold mb-6">Internal Ops Dashboard</h1>

      <div className="grid gap-6">
        {/* Queue overview */}
        <Card>
          <CardHeader>
            <CardTitle>Queue Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Total queue depth: <strong>{stats.queueDepth}</strong>{" "}
              {!stats.queueAvailable && (
                <Badge variant="secondary">Redis unavailable</Badge>
              )}
            </p>
          </CardContent>
        </Card>

        {/* Per-integration stats */}
        <Card>
          <CardHeader>
            <CardTitle>Per-Integration Stats (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.providerStats.length === 0 ? (
              <p className="text-muted-foreground">No integration activity yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium">Provider</th>
                      <th className="text-right py-2 font-medium">Queue</th>
                      <th className="text-right py-2 font-medium">Processed</th>
                      <th className="text-right py-2 font-medium">Failed</th>
                      <th className="text-right py-2 font-medium">Fail % 24h</th>
                      <th className="text-right py-2 font-medium">Fail % 1h</th>
                      <th className="text-right py-2 font-medium">Alert</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.providerStats.map((p) => (
                      <tr
                        key={p.provider}
                        className={
                          p.alert1h
                            ? "border-b bg-destructive/10"
                            : "border-b"
                        }
                      >
                        <td className="py-2">{p.providerLabel}</td>
                        <td className="text-right py-2">{p.queueDepth}</td>
                        <td className="text-right py-2">{p.jobsProcessed24h}</td>
                        <td className="text-right py-2">{p.jobsFailed24h}</td>
                        <td className="text-right py-2">
                          {p.failureRate24h.toFixed(1)}%
                        </td>
                        <td className="text-right py-2">
                          {p.failureRate1h.toFixed(1)}%
                        </td>
                        <td className="text-right py-2">
                          {p.alert1h && (
                            <Badge variant="destructive" className="gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              &gt;10%
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Last 50 failed jobs */}
        <Card>
          <CardHeader>
            <CardTitle>Last 50 Failed Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.failedJobs.length === 0 ? (
              <p className="text-muted-foreground">No failed jobs.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium">Provider</th>
                      <th className="text-left py-2 font-medium">Audit Pack ID</th>
                      <th className="text-left py-2 font-medium">Error</th>
                      <th className="text-right py-2 font-medium">Retries</th>
                      <th className="text-right py-2 font-medium">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.failedJobs.map((j) => (
                      <tr key={j.id} className="border-b">
                        <td className="py-2">{j.providerLabel}</td>
                        <td className="py-2 font-mono text-xs">
                          {j.meetingId ?? "—"}
                        </td>
                        <td className="py-2 max-w-xs truncate" title={j.errorMessage ?? undefined}>
                          {j.errorMessage ?? "—"}
                        </td>
                        <td className="text-right py-2">{j.attempts}</td>
                        <td className="text-right py-2 text-muted-foreground">
                          {j.createdAt.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
