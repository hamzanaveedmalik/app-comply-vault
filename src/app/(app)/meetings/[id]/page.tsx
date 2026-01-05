import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import type { TranscriptSegment } from "~/server/transcription";
import type { ExtractionData } from "~/server/extraction/types";
import ExtractedFields from "./extracted-fields";

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "UPLOADING":
        return "bg-gray-100 text-gray-800";
      case "PROCESSING":
        return "bg-blue-100 text-blue-800";
      case "DRAFT_READY":
        return "bg-green-100 text-green-800";
      case "DRAFT":
        return "bg-yellow-100 text-yellow-800";
      case "FINALIZED":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
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
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Meeting Details
          </h1>
        </div>

        <div className="space-y-6">
          {/* Overview Card */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900">Overview</h2>
            <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Client Name</dt>
                <dd className="mt-1 text-sm text-gray-900">{meeting.clientName}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Meeting Type</dt>
                <dd className="mt-1 text-sm text-gray-900">{meeting.meetingType}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Meeting Date</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(meeting.meetingDate).toLocaleDateString()}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Status</dt>
                <dd className="mt-1">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getStatusColor(meeting.status)}`}
                  >
                    {getStatusLabel(meeting.status)}
                  </span>
                </dd>
              </div>
            </dl>
          </div>

          {/* Two-Column Layout: Transcript + Extracted Fields */}
          {meeting.status === "DRAFT_READY" || meeting.status === "DRAFT" || meeting.status === "FINALIZED" ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Left Column: Transcript */}
              <div className="rounded-lg bg-white p-6 shadow">
                <h2 className="mb-4 text-lg font-semibold text-gray-900">
                  Transcript
                </h2>
                {transcript && transcript.segments && transcript.segments.length > 0 ? (
                  <div className="max-h-[600px] space-y-4 overflow-y-auto">
                    {transcript.segments.map((segment, index) => (
                      <div
                        key={index}
                        data-timestamp={Math.floor(segment.startTime)}
                        className="border-l-4 border-blue-500 pl-4"
                      >
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <span className="font-medium">
                            {formatTime(segment.startTime)}
                          </span>
                          <span className="text-gray-400">•</span>
                          <span className="font-medium text-blue-600">
                            {segment.speaker}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-gray-900">
                          {segment.text}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-md bg-gray-50 p-4">
                    <p className="text-sm text-gray-600">
                      Transcript is not available yet. Please check back in a few moments.
                    </p>
                  </div>
                )}
              </div>

              {/* Right Column: Extracted Fields */}
              <div className="rounded-lg bg-white p-6 shadow">
                <h2 className="mb-4 text-lg font-semibold text-gray-900">
                  Extracted Fields
                </h2>
                <ExtractedFields extraction={extraction} />
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-blue-50 p-4">
              <p className="text-sm text-blue-800">
                {meeting.status === "PROCESSING"
                  ? "This meeting is being processed. The transcript will be available once processing is complete."
                  : "This meeting is still uploading. Please wait for processing to complete."}
              </p>
            </div>
          )}

          {meeting.status === "FINALIZED" && (
            <div className="rounded-lg bg-green-50 p-4">
              <p className="text-sm text-green-800">
                This meeting has been finalized. Export options will be available here once implemented.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
