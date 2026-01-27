import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { redirect } from "next/navigation";
import AuditLogsClient from "./audit-logs-client";

// Force dynamic rendering since we use searchParams
export const dynamic = "force-dynamic";

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();

  if (!session?.user?.workspaceId) {
    redirect("/workspaces/new");
  }

  // Only OWNER_CCO can view audit logs
  if (session.user.role !== "OWNER_CCO") {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const userId = typeof params.userId === "string" ? params.userId : undefined;
  const action = typeof params.action === "string" ? params.action : undefined;
  const resourceType = typeof params.resourceType === "string" ? params.resourceType : undefined;
  const dateFrom = typeof params.dateFrom === "string" ? params.dateFrom : undefined;
  const dateTo = typeof params.dateTo === "string" ? params.dateTo : undefined;

  // Build where clause
  const where: any = {
    workspaceId: session.user.workspaceId,
  };

  if (userId) {
    where.userId = userId;
  }

  if (
    action &&
    [
      "UPLOAD",
      "VIEW",
      "EDIT",
      "FINALIZE",
      "EXPORT",
      "DELETE",
      "REMEDIATION_START",
      "REMEDIATION_UPDATE",
      "TASK_UPDATE",
      "EVIDENCE_ADD",
      "VERIFICATION",
      "OVERRIDE",
      "WORKSPACE_CREATED",
      "INVITE_SENT",
      "INVITE_RESENT",
      "INVITE_ACCEPTED",
    ].includes(action)
  ) {
    where.action = action;
  }

  if (resourceType) {
    where.resourceType = resourceType;
  }

  if (dateFrom || dateTo) {
    where.timestamp = {};
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      where.timestamp.gte = fromDate;
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      where.timestamp.lte = toDate;
    }
  }

  let events: any[] = [];
  let total = 0;
  let error: string | null = null;

  try {
    // Fetch audit events with user and meeting details
    const [auditEvents, eventCount] = await Promise.all([
      db.auditEvent.findMany({
        where,
        orderBy: {
          timestamp: "desc",
        },
        take: 100,
        include: {
          meeting: {
            select: {
              id: true,
              clientName: true,
              meetingDate: true,
            },
          },
        },
      }),
      db.auditEvent.count({ where }),
    ]);

    // Fetch user details
    const userIds = [...new Set(auditEvents.map((e) => e.userId))];
    const users = await db.user.findMany({
      where: {
        id: {
          in: userIds,
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    // Format events
    events = auditEvents.map((event) => ({
      id: event.id,
      timestamp: event.timestamp.toISOString(),
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      metadata: event.metadata,
      user: userMap.get(event.userId) || {
        id: event.userId,
        name: null,
        email: null,
      },
      meeting: event.meeting
        ? {
            id: event.meeting.id,
            clientName: event.meeting.clientName,
            meetingDate: event.meeting.meetingDate.toISOString(),
          }
        : null,
    }));

    total = eventCount;
  } catch (err) {
    console.error("Error fetching audit logs:", err);
    error = err instanceof Error ? err.message : "An unknown error occurred";
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Audit Logs</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          View and export audit trail for compliance and security monitoring.
        </p>
      </div>

      <AuditLogsClient
        initialEvents={events}
        initialTotal={total}
        initialFilters={{
          userId: userId || "",
          action: action || "",
          resourceType: resourceType || "",
          dateFrom: dateFrom || "",
          dateTo: dateTo || "",
        }}
        error={error}
      />
    </div>
  );
}

