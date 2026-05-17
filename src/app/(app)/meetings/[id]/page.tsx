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
import TranscriptViewer from "./transcript-viewer";
import FinalizeButton from "./finalize-button";
import { MeetingStatusPoller } from "./meeting-status-poller";
import RetryButton from "./retry-button";
import FlagsPanel from "./flags-panel";
import { IntegrationSyncPanel } from "./integration-sync-panel";
import { ZohoCrmContactField } from "./zoho-crm-contact-field";
import { validateEvidenceCoverage } from "~/server/extraction/evidence";
import MeetingWorkflowPanel from "./meeting-workflow-panel";
import CmFlagTriageList from "./cm-flag-triage";
import TranscriptEditor from "./transcript-editor";
import { isAdvisorActor, isComplianceActor } from "~/lib/meeting-workflow";

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
    include: {
      advisorCertifiedByUser: { select: { name: true, email: true } },
      cmReviewedByUser: { select: { name: true, email: true } },
      ccoSignedOffByUser: { select: { name: true, email: true } },
    },
  });

  if (!meeting) {
    notFound();
  }

  // Parse extraction data if available
  const extraction = meeting.extraction as ExtractionData | null | undefined;

  const [flags, syncLogs, configs, zohoCrmCredential] = await Promise.all([
    db.flag.findMany({
      where: { meetingId: meeting.id },
      orderBy: { createdAt: "desc" },
      include: {
        resolutionRecord: {
          include: {
            tasks: true,
            evidence: true,
            verifications: true,
          },
        },
      },
    }),
    db.integrationSyncLog.findMany({
      where: { meetingId: meeting.id },
      orderBy: { createdAt: "desc" },
    }),
    db.integrationConfig.findMany({
      where: { workspaceId: session.user.workspaceId },
      select: { provider: true },
    }),
    db.integrationCredential.findUnique({
      where: {
        workspaceId_provider: { workspaceId: session.user.workspaceId, provider: "ZOHO_CRM" },
      },
    }),
  ]);

  const syncStatuses = configs.flatMap((c) => {
    const logs = syncLogs.filter((l) => l.provider === c.provider);
    if (logs.length === 0) {
      return [{ provider: c.provider, action: "sync", status: "Pending" as const, lastSyncAt: null, errorMessage: null }];
    }
    return logs.map((l) => ({
      provider: c.provider,
      action: l.action,
      status: (l.status === "success" ? "Synced" : l.status === "failed" ? "Failed" : "Pending") as "Synced" | "Pending" | "Failed",
      lastSyncAt: l.completedAt?.toISOString() ?? null,
      errorMessage: l.errorMessage,
    }));
  });

  const isFlagOpen = (status: string) =>
    status !== "CLOSED" && status !== "CLOSED_ACCEPTED_RISK";
  const openFlags = flags.filter((flag) => isFlagOpen(flag.status));
  const openCriticalFlags = openFlags.filter((flag) => flag.severity === "CRITICAL");
  const openWarningFlags = openFlags.filter((flag) => flag.severity === "WARN");
  const evidenceStats = extraction?.evidenceMap
    ? validateEvidenceCoverage(extraction.evidenceMap)
    : null;
  const editedClaimsCount = extraction?.evidenceMap
    ? extraction.evidenceMap.filter((item) => item.edited).length
    : 0;

  // Parse transcript if available
  const transcript = meeting.transcript as
    | { segments: TranscriptSegment[] }
    | null
    | undefined;

  // Ensure segments are properly serialized (plain objects only)
  const transcriptSegments = transcript?.segments?.map((seg) => ({
    startTime: seg.startTime,
    endTime: seg.endTime,
    speaker: seg.speaker,
    text: seg.text,
  })) ?? [];

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

  const cmReviewSummary = meeting.cmReviewSummary as {
    resolved?: number;
    noted?: number;
    escalated?: number;
  } | null;

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
      case "ADVISOR_CERTIFIED":
        return "default";
      case "CM_REVIEWED":
        return "outline";
      case "CCO_SIGNED_OFF":
        return "default";
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
      case "ADVISOR_CERTIFIED":
        return "Advisor certified";
      case "CM_REVIEWED":
        return "CM reviewed";
      case "CCO_SIGNED_OFF":
        return "CCO signed off";
      case "FINALIZED":
        return "Finalized";
      default:
        return status;
    }
  };


  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Poll for status changes */}
      <MeetingStatusPoller
        meetingId={meeting.id}
        initialStatus={meeting.status}
        clientName={meeting.clientName}
      />
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

        {/* Review Readiness Banner */}
        <Card className={openCriticalFlags.length > 0 ? "border-red-300" : "border-emerald-300"}>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">
                  {openCriticalFlags.length > 0
                    ? `Blocked: ${openCriticalFlags.length} critical flag${openCriticalFlags.length > 1 ? "s" : ""} open`
                    : "Ready: no critical flags open"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {openWarningFlags.length > 0
                    ? `${openWarningFlags.length} warning flag${openWarningFlags.length > 1 ? "s" : ""} remain open`
                    : "No warning flags open"}
                </p>
              </div>
              <div className="text-xs text-muted-foreground">
                Evidence coverage: {evidenceStats ? `${(evidenceStats.coverage * 100).toFixed(1)}%` : "N/A"}
              </div>
            </div>
          </CardContent>
        </Card>

        <MeetingWorkflowPanel
          meetingId={meeting.id}
          status={meeting.status}
          userRole={session.user.role}
          flags={flags.map((f) => ({
            id: f.id,
            status: f.status,
            cmDisposition: f.cmDisposition,
            type: f.type,
            severity: f.severity,
          }))}
          advisorCertifiedAt={meeting.advisorCertifiedAt?.toISOString() ?? null}
          advisorName={
            meeting.advisorCertifiedByUser?.name ??
            meeting.advisorCertifiedByUser?.email ??
            null
          }
          cmReviewedAt={meeting.cmReviewedAt?.toISOString() ?? null}
          cmName={meeting.cmReviewedByUser?.name ?? meeting.cmReviewedByUser?.email ?? null}
          ccoSignedOffAt={meeting.ccoSignedOffAt?.toISOString() ?? null}
          ccoName={meeting.ccoSignedOffByUser?.name ?? meeting.ccoSignedOffByUser?.email ?? null}
          cmReviewSummary={cmReviewSummary}
        />

        {meeting.status === "ADVISOR_CERTIFIED" && isComplianceActor(session.user.role) && (
          <CmFlagTriageList
            meetingId={meeting.id}
            flags={flags.map((f) => ({
              id: f.id,
              type: f.type,
              severity: f.severity,
              status: f.status,
              cmDisposition: f.cmDisposition,
              escalationReason: f.escalationReason,
              cmTriageNote: f.cmTriageNote,
            }))}
          />
        )}

        <FlagsPanel
          flags={flags.map((flag) => ({
            id: flag.id,
            type: flag.type,
            severity: flag.severity,
            status: flag.status,
            evidence: flag.evidence,
            createdAt: flag.createdAt.toISOString(),
            resolutionRecord: flag.resolutionRecord
              ? {
                  id: flag.resolutionRecord.id,
                  resolutionType: flag.resolutionRecord.resolutionType,
                  rationale: flag.resolutionRecord.rationale,
                  metadata: flag.resolutionRecord.metadata,
                  submittedForVerificationAt:
                    flag.resolutionRecord.submittedForVerificationAt?.toISOString() ?? null,
                  closedAt: flag.resolutionRecord.closedAt?.toISOString() ?? null,
                  overrideReason: flag.resolutionRecord.overrideReason,
                  overrideCategory: flag.resolutionRecord.overrideCategory,
                  tasks: flag.resolutionRecord.tasks.map((task) => ({
                    id: task.id,
                    title: task.title,
                    status: task.status,
                    ownerId: task.ownerId,
                    dueDate: task.dueDate.toISOString(),
                    required: task.required,
                    completionNote: task.completionNote,
                    completedAt: task.completedAt?.toISOString() ?? null,
                  })),
                  evidence: flag.resolutionRecord.evidence.map((item) => ({
                    id: item.id,
                    type: item.type,
                    label: item.label,
                    url: item.url,
                    metadata: item.metadata,
                    createdAt: item.createdAt.toISOString(),
                  })),
                  verifications: flag.resolutionRecord.verifications.map((verification) => ({
                    id: verification.id,
                    reviewerId: verification.reviewerId,
                    decision: verification.decision,
                    note: verification.note,
                    decidedAt: verification.decidedAt.toISOString(),
                  })),
                }
              : null,
          }))}
          userRole={session.user.role}
          currentUserId={session.user.id}
          readOnlyCompliance={session.user.role === "ADVISOR"}
        />

        {zohoCrmCredential?.status === "CONNECTED" &&
          (meeting.status === "DRAFT_READY" || meeting.status === "DRAFT") && (
            <Card>
              <CardHeader>
                <CardTitle>Zoho CRM</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <ZohoCrmContactField
                  meetingId={meeting.id}
                  initialContactId={meeting.zohoCrmContactId}
                  canEdit={session.user.role === "OWNER_CCO"}
                />
                {meeting.zohoCrmNotePostedAt && (
                  <p className="text-xs text-muted-foreground">
                    CRM note created {meeting.zohoCrmNotePostedAt.toLocaleString()}.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

        {/* Two-Column Layout: Transcript + Extracted Fields */}
        {meeting.status === "DRAFT_READY" ||
        meeting.status === "DRAFT" ||
        meeting.status === "FINALIZED" ||
        meeting.status === "ADVISOR_CERTIFIED" ||
        meeting.status === "CM_REVIEWED" ||
        meeting.status === "CCO_SIGNED_OFF" ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Left Column: Transcript */}
            <Card>
              <CardHeader>
                <CardTitle>Transcript</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <TranscriptViewer segments={transcriptSegments} />
                {(meeting.status === "DRAFT_READY" || meeting.status === "DRAFT") &&
                  isAdvisorActor(session.user.role) &&
                  transcriptSegments.length > 0 && (
                    <TranscriptEditor
                      meetingId={meeting.id}
                      segments={transcriptSegments}
                      canEdit
                    />
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
                  <ExtractedFields
                    extraction={extraction}
                    flags={flags.map((flag) => ({
                      id: flag.id,
                      type: flag.type,
                      severity: flag.severity,
                      status: flag.status,
                      evidence: flag.evidence,
                    }))}
                  />
                ) : (
                  <EditableFields
                    meetingId={meeting.id}
                    extraction={extraction}
                    isReadOnly={
                      session.user.role === "ADVISOR" || meeting.status === "CCO_SIGNED_OFF"
                    }
                    transcript={transcript}
                    flags={flags.map((flag) => ({
                      id: flag.id,
                      type: flag.type,
                      severity: flag.severity,
                      status: flag.status,
                      evidence: flag.evidence,
                    }))}
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
            <CardContent className="pt-6 space-y-4">
              <p className="text-sm text-muted-foreground">
                {meeting.status === "PROCESSING"
                  ? "This meeting is being processed. The transcript will be available once processing is complete."
                  : "This meeting is still uploading. Please wait for processing to complete."}
              </p>
              {meeting.status === "PROCESSING" && (
                <RetryButton
                  meetingId={meeting.id}
                  status={meeting.status}
                  hasFile={!!meeting.fileUrl}
                  type="processing"
                />
              )}
            </CardContent>
          </Card>
        )}

        {meeting.status === "FINALIZED" && meeting.sharepointItemWebUrl && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                Audit pack was filed to your connected Microsoft 365 storage.{" "}
                <a
                  href={meeting.sharepointItemWebUrl}
                  className="text-primary underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in browser
                </a>
                {meeting.sharepointDepositedAt && (
                  <span className="block mt-2 text-xs">
                    Deposited {meeting.sharepointDepositedAt.toLocaleString()}
                  </span>
                )}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Export draft / in-progress audit pack */}
        {(meeting.status === "DRAFT_READY" ||
          meeting.status === "DRAFT" ||
          meeting.status === "ADVISOR_CERTIFIED" ||
          meeting.status === "CM_REVIEWED" ||
          meeting.status === "CCO_SIGNED_OFF" ||
          meeting.status === "FINALIZED") && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm mb-2">
                {meeting.status === "FINALIZED"
                  ? "This meeting has been finalized and is ready for export."
                  : "Export an audit pack (draft or current workflow state). Finalized packs include the full sign-off trail once all steps are complete."}
              </p>
              <ExportButton
                meetingId={meeting.id}
                status={meeting.status}
                hasExtraction={!!extraction}
                openFlagsCount={openFlags.length}
              />
            </CardContent>
          </Card>
        )}

        {/* Finalize Button (CCO only, after CCO sign-off) */}
        {meeting.status === "CCO_SIGNED_OFF" && (
          <Card>
            <CardContent className="pt-6">
              <FinalizeButton
                meetingId={meeting.id}
                meetingStatus={meeting.status}
                userRole={session.user.role}
                evidenceCoverage={evidenceStats?.coverage ?? null}
                editedClaimsCount={editedClaimsCount}
                openCriticalFlagsCount={openCriticalFlags.length}
                openWarningFlagsCount={openWarningFlags.length}
              />
            </CardContent>
          </Card>
        )}

        {/* Version History */}
        {(meeting.status === "DRAFT_READY" ||
          meeting.status === "DRAFT" ||
          meeting.status === "ADVISOR_CERTIFIED" ||
          meeting.status === "CM_REVIEWED" ||
          meeting.status === "CCO_SIGNED_OFF" ||
          meeting.status === "FINALIZED") && (
          <Card>
            <CardHeader>
              <CardTitle>Version History</CardTitle>
            </CardHeader>
            <CardContent>
              <VersionHistory meetingId={meeting.id} />
            </CardContent>
          </Card>
        )}

        {/* Integration Sync Status */}
        {syncStatuses.length > 0 && (
          <IntegrationSyncPanel
            meetingId={meeting.id}
            syncStatuses={syncStatuses}
          />
        )}

      </div>
    </div>
  );
}
