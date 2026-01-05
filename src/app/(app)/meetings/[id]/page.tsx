import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import type { TranscriptSegment } from "~/server/transcription";
import type { ExtractionData } from "~/server/extraction/types";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import ExtractedFields from "./extracted-fields";
import EditableFields from "./editable-fields";
import ReprocessButton from "./reprocess-button";
import ExportButton from "./export-button";
import VersionHistory from "./version-history";

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  if (!session?.user?.workspaceId) {
    redirect("/workspaces/new");
  }

  const { id } = await params;

  const meeting = await db.meeting.findFirst({
    where: {
      id,
      workspaceId: session.user.workspaceId,
    },
  });

  if (!meeting) {
    notFound();
  }

  // Parse transcript if available
  const transcript = meeting.transcript as
    | { segments: TranscriptSegment[] }
    | null
    | undefined;

  // Parse extraction data if available
  const extraction = meeting.extraction as ExtractionData | null | undefined;

  // Log view event
  if (session.user.id) {
    await db.auditEvent.create({
      data: {
        workspaceId: session.user.workspaceId,
        userId: session.user.id,
        action: "VIEW",
        resourceType: "meeting",
        resourceId: meeting.id,
        meetingId: meeting.id,
        metadata: {
          viewedAt: new Date().toISOString(),
        },
      },
    });
  }

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "UPLOADING":
        return "secondary";
      case "PROCESSING":
        return "default";
      case "DRAFT_READY":
        return "default";
      case "DRAFT":
        return "outline";
      case "FINALIZED":
        return "default";
      default:
        return "secondary";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "UPLOADING":
        return "Uploading";
      case "PROCESSING":
        return "Processing";
      case "DRAFT_READY":
        return "Draft Ready";
      case "DRAFT":
        return "Draft";
      case "FINALIZED":
        return "Finalized";
      default:
        return status;
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Meeting Details</h1>
      </div>

      <div className="space-y-6">
        {/* Overview Card */}
        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Client Name</dt>
                <dd className="mt-1 text-sm">{meeting.clientName}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Meeting Type</dt>
                <dd className="mt-1 text-sm">{meeting.meetingType}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Meeting Date</dt>
                <dd className="mt-1 text-sm">
                  {new Date(meeting.meetingDate).toLocaleDateString()}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Status</dt>
                <dd className="mt-1">
                  <Badge variant={getStatusVariant(meeting.status)}>
                    {getStatusLabel(meeting.status)}
                  </Badge>
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Two-Column Layout: Transcript + Extracted Fields */}
        {meeting.status === "DRAFT_READY" || meeting.status === "DRAFT" || meeting.status === "FINALIZED" ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Left Column: Transcript */}
            <Card>
              <CardHeader>
                <CardTitle>Transcript</CardTitle>
              </CardHeader>
              <CardContent>
                {transcript && transcript.segments && transcript.segments.length > 0 ? (
                  <div className="max-h-[600px] space-y-4 overflow-y-auto">
                    {transcript.segments.map((segment, index) => (
                      <div
                        key={index}
                        data-timestamp={Math.floor(segment.startTime)}
                        data-segment-start={segment.startTime}
                        className="border-l-4 border-primary pl-4 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => {
                          // Dispatch custom event to set timestamp in editable fields
                          window.dispatchEvent(new CustomEvent('setTimestamp', { 
                            detail: { timestamp: segment.startTime } 
                          }));
                        }}
                        title="Click to use this timestamp when adding/editing items"
                      >
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="font-medium">
                            {formatTime(segment.startTime)}
                          </span>
                          <span className="text-muted-foreground/50">•</span>
                          <span className="font-medium text-primary">
                            {segment.speaker}
                          </span>
                        </div>
                        <p className="mt-1 text-sm">
                          {segment.text}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-md bg-muted p-4">
                    <p className="text-sm text-muted-foreground">
                      Transcript is not available yet. Please check back in a few moments.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Right Column: Extracted Fields */}
            <Card>
              <CardHeader>
                <CardTitle>Extracted Fields</CardTitle>
              </CardHeader>
              <CardContent>
                {meeting.status === "FINALIZED" ? (
                  <ExtractedFields extraction={extraction} />
                ) : (
                  <EditableFields
                    meetingId={meeting.id}
                    extraction={extraction}
                    isReadOnly={meeting.status === "FINALIZED"}
                    transcript={transcript}
                  />
                )}
                {meeting.status !== "FINALIZED" && (
                  <ReprocessButton
                    meetingId={meeting.id}
                    hasTranscript={!!(transcript && transcript.segments && transcript.segments.length > 0)}
                    hasExtraction={!!extraction}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                {meeting.status === "PROCESSING"
                  ? "This meeting is being processed. The transcript will be available once processing is complete."
                  : "This meeting is still uploading. Please wait for processing to complete."}
              </p>
            </CardContent>
          </Card>
        )}

        {meeting.status === "FINALIZED" && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm mb-2">
                This meeting has been finalized and is ready for export.
              </p>
              <ExportButton
                meetingId={meeting.id}
                status={meeting.status}
                hasExtraction={!!extraction}
              />
            </CardContent>
          </Card>
        )}

        {/* Export button for DRAFT_READY meetings */}
        {meeting.status === "DRAFT_READY" && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm mb-2">
                This meeting is ready for review. You can export a draft audit pack.
              </p>
              <ExportButton
                meetingId={meeting.id}
                status={meeting.status}
                hasExtraction={!!extraction}
              />
            </CardContent>
          </Card>
        )}

        {/* Version History */}
        {(meeting.status === "DRAFT_READY" || meeting.status === "DRAFT" || meeting.status === "FINALIZED") && (
          <Card>
            <CardHeader>
              <CardTitle>Version History</CardTitle>
            </CardHeader>
            <CardContent>
              <VersionHistory meetingId={meeting.id} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
