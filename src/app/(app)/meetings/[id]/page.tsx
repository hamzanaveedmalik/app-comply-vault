import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import type { TranscriptSegment } from "~/server/transcription";
import type { ExtractionData } from "~/server/extraction/types";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import ExtractedFields from "./extracted-fields";
import EditableFields from "./editable-fields";
import ReprocessButton from "./reprocess-button";
import ExportButton from "./export-button";
import VersionHistory from "./version-history";
import TranscriptViewer from "./transcript-viewer";
import { MeetingStatusPoller } from "./meeting-status-poller";
import RetryButton from "./retry-button";
import { IntegrationSyncPanel } from "./integration-sync-panel";
import { ZohoCrmContactField } from "./zoho-crm-contact-field";
import { validateEvidenceCoverage } from "~/server/extraction/evidence";
import TranscriptEditor from "./transcript-editor";
import { isAdvisorActor, isComplianceActor, flagIsCmTriaged } from "~/lib/meeting-workflow";
import { MeetingHeaderCard } from "~/components/meetings/meeting-header-card";
import { MeetingWorkflowProgress } from "~/components/meetings/meeting-workflow-progress";
import { ReviewActionBar } from "~/components/meetings/review-action-bar";
import { CcoRevertPanel } from "~/components/meetings/cco-revert-panel";
import { MeetingTranscriptSection } from "~/components/meetings/meeting-transcript-section";
import MeetingFlagsWorkspace from "./meeting-flags-workspace";
import { buildMeetingSyncToken } from "~/lib/meeting-sync-token";
import { MeetingStaleBanner } from "~/components/meetings/meeting-stale-banner";

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
      workspace: { select: { name: true } },
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

  const topicCount = Array.isArray((extraction as { topics?: unknown[] } | null)?.topics)
    ? (extraction as { topics: unknown[] }).topics.length
    : 0;
  const recommendationCount = Array.isArray((extraction as { recommendations?: unknown[] } | null)?.recommendations)
    ? (extraction as { recommendations: unknown[] }).recommendations.length
    : 0;

  const flagsAwaitingTriage = flags.filter(
    (f) => !flagIsCmTriaged({ status: f.status, cmDisposition: f.cmDisposition }),
  ).length;

  const advisorTranscriptExpanded =
    (meeting.status === "DRAFT_READY" || meeting.status === "DRAFT") && session.user.role === "ADVISOR";

  const initialSyncToken = buildMeetingSyncToken(meeting.status, meeting.updatedAt, flags);

  const mappedFlags = flags.map((flag) => ({
    id: flag.id,
    type: flag.type,
    severity: flag.severity,
    status: flag.status,
    evidence: flag.evidence,
    createdAt: flag.createdAt.toISOString(),
    cmDisposition: flag.cmDisposition,
    escalationReason: flag.escalationReason,
    cmTriageNote: flag.cmTriageNote,
    resolutionNote: flag.resolutionNote,
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
  }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Poll for status changes */}
      <MeetingStatusPoller
        meetingId={meeting.id}
        initialStatus={meeting.status}
        clientName={meeting.clientName}
      />
      <MeetingStaleBanner
        meetingId={meeting.id}
        meetingStatus={meeting.status}
        initialSyncToken={initialSyncToken}
      />
      <div className="space-y-5">
        <MeetingHeaderCard
          clientName={meeting.clientName}
          meetingDate={meeting.meetingDate}
          meetingType={meeting.meetingType}
          advisorLabel={
            meeting.advisorCertifiedByUser?.name ??
            meeting.advisorCertifiedByUser?.email ??
            "—"
          }
          firmLabel={meeting.workspace.name}
          status={meeting.status}
        />

        {meeting.status === "ADVISOR_CERTIFIED" && isComplianceActor(session.user.role) && (
          <div className="rounded-xl border border-[#E6F1FB] bg-[#E6F1FB]/35 px-5 py-4 text-[13px] text-[#0C447C]">
            Awaiting compliance review — {flagsAwaitingTriage} flag{flagsAwaitingTriage === 1 ? "" : "s"}{" "}
            require triage
          </div>
        )}

        {!(
          meeting.status === "ADVISOR_CERTIFIED" && isComplianceActor(session.user.role)
        ) && (
          <Card
            className={
              openCriticalFlags.length > 0 ? "border-amber-200/80 bg-[#FAEEDA]/25" : "border-emerald-200/80"
            }
          >
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold">
                    {openCriticalFlags.length > 0
                      ? `${openCriticalFlags.length} critical flag${openCriticalFlags.length > 1 ? "s" : ""} open (review in flag workspace)`
                      : "No critical flags open"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {openWarningFlags.length > 0
                      ? `${openWarningFlags.length} warning flag${openWarningFlags.length > 1 ? "s" : ""}`
                      : "No warning flags open"}
                  </p>
                </div>
                <div className="text-xs text-muted-foreground">
                  Evidence coverage: {evidenceStats ? `${(evidenceStats.coverage * 100).toFixed(1)}%` : "N/A"}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <MeetingWorkflowProgress
          meetingStatus={meeting.status}
          userRole={session.user.role}
          advisorName={
            meeting.advisorCertifiedByUser?.name ?? meeting.advisorCertifiedByUser?.email ?? null
          }
          advisorCertifiedAt={meeting.advisorCertifiedAt?.toISOString() ?? null}
          flags={flags.map((f) => ({ status: f.status, cmDisposition: f.cmDisposition }))}
        />

        <section className="space-y-3">
          <MeetingFlagsWorkspace
            meetingId={meeting.id}
            meetingStatus={meeting.status}
            flags={mappedFlags}
            userRole={session.user.role}
            currentUserId={session.user.id}
            readOnlyCompliance={session.user.role === "ADVISOR"}
          />
          <ReviewActionBar
            meetingId={meeting.id}
            clientName={meeting.clientName}
            meetingStatus={meeting.status}
            userRole={session.user.role}
            flags={flags.map((f) => ({
              id: f.id,
              status: f.status,
              cmDisposition: f.cmDisposition,
            }))}
            evidenceCoverage={evidenceStats?.coverage ?? null}
            editedClaimsCount={editedClaimsCount}
            openCriticalFlagsCount={openCriticalFlags.length}
            openWarningFlagsCount={openWarningFlags.length}
          />
        </section>

        <CcoRevertPanel meetingId={meeting.id} meetingStatus={meeting.status} userRole={session.user.role} />

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

        {/* Transcript + extracted fields */}
        {meeting.status === "DRAFT_READY" ||
        meeting.status === "DRAFT" ||
        meeting.status === "FINALIZED" ||
        meeting.status === "ADVISOR_CERTIFIED" ||
        meeting.status === "CM_REVIEWED" ||
        meeting.status === "CCO_SIGNED_OFF" ? (
          <MeetingTranscriptSection
            collapsedByDefault={!advisorTranscriptExpanded}
            transcriptSegments={transcriptSegments}
            topicCount={topicCount}
            recommendationCount={recommendationCount}
            advisorExpandedGrid={
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Transcript</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <TranscriptViewer segments={transcriptSegments} />
                    {(meeting.status === "DRAFT_READY" || meeting.status === "DRAFT") &&
                      isAdvisorActor(session.user.role) &&
                      transcriptSegments.length > 0 && (
                        <TranscriptEditor meetingId={meeting.id} segments={transcriptSegments} canEdit />
                      )}
                  </CardContent>
                </Card>
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
              </>
            }
            expandedContent={
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Transcript</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TranscriptViewer segments={transcriptSegments} />
                  </CardContent>
                </Card>
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
            }
          />
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
