import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const session = await auth();

  // Redirect to workspace creation if user has no workspace
  if (!session?.user?.workspaceId || session.user.workspaceId === "") {
    redirect("/workspaces/new");
  }

  // Fetch meetings for the workspace (optimized: select only needed fields)
  const meetings = await db.meeting.findMany({
    where: {
      workspaceId: session.user.workspaceId,
    },
    select: {
      id: true,
      clientName: true,
      meetingType: true,
      meetingDate: true,
      status: true,
      createdAt: true,
      readyForCCO: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 50, // Limit to 50 most recent
  });

  // Calculate metrics
  const totalMeetings = await db.meeting.count({
    where: {
      workspaceId: session.user.workspaceId,
    },
  });

  const finalizedMeetings = await db.meeting.findMany({
    where: {
      workspaceId: session.user.workspaceId,
      status: "FINALIZED",
    },
    select: {
      timeToFinalize: true,
    },
  });

  const finalizedCount = finalizedMeetings.length;
  const finalizeRate = totalMeetings > 0 ? (finalizedCount / totalMeetings) * 100 : 0;

  // Calculate Time-to-Finalize metrics
  const timeToFinalizeValues = finalizedMeetings
    .map((m) => m.timeToFinalize)
    .filter((v): v is number => v !== null && v !== undefined)
    .sort((a, b) => a - b);

  let medianTimeToFinalize: number | null = null;
  let p90TimeToFinalize: number | null = null;

  if (timeToFinalizeValues.length > 0) {
    // Calculate median
    const mid = Math.floor(timeToFinalizeValues.length / 2);
    medianTimeToFinalize =
      timeToFinalizeValues.length % 2 === 0
        ? (timeToFinalizeValues[mid - 1]! + timeToFinalizeValues[mid]!) / 2
        : timeToFinalizeValues[mid]!;

    // Calculate P90 (90th percentile)
    const p90Index = Math.ceil(timeToFinalizeValues.length * 0.9) - 1;
    p90TimeToFinalize = timeToFinalizeValues[p90Index] ?? null;
  }

  const formatTime = (seconds: number | null): string => {
    if (seconds === null) return "N/A";
    const minutes = seconds / 60;
    return `${minutes.toFixed(1)} min`;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            View and manage your meeting recordings
          </p>
        </div>
        <Button asChild>
          <Link href="/upload">Upload Meeting</Link>
        </Button>
      </div>

      {/* Metrics Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Meetings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMeetings}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Finalized
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{finalizedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {Math.round(finalizeRate * 10) / 10}% finalize rate
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Time-to-Finalize (Median)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatTime(medianTimeToFinalize)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {timeToFinalizeValues.length > 0
                ? `Target: ≤ 10 min (${medianTimeToFinalize! <= 600 ? "✓" : "✗"})`
                : "No finalized meetings yet"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Time-to-Finalize (P90)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatTime(p90TimeToFinalize)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {timeToFinalizeValues.length > 0
                ? `Target: ≤ 15 min (${p90TimeToFinalize! <= 900 ? "✓" : "✗"})`
                : "No finalized meetings yet"}
            </p>
          </CardContent>
        </Card>
      </div>

      {meetings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-lg text-muted-foreground">No meetings yet</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Upload your first meeting recording to get started
            </p>
            <Button asChild className="mt-4">
              <Link href="/upload">Upload Meeting</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <DashboardClient
          initialMeetings={meetings.map((m) => ({
            id: m.id,
            clientName: m.clientName,
            meetingType: m.meetingType,
            meetingDate: m.meetingDate.toISOString(),
            status: m.status,
            createdAt: m.createdAt.toISOString(),
          }))}
        />
      )}
    </div>
  );
}


