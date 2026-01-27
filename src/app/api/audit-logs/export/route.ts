import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { z } from "zod";

const auditLogQuerySchema = z.object({
  userId: z.string().optional(),
  action: z
    .enum([
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
    ])
    .optional(),
  resourceType: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.workspaceId || !session.user.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only OWNER_CCO can export audit logs
    if (session.user.role !== "OWNER_CCO") {
      return Response.json(
        { error: "Forbidden: Only workspace owners can export audit logs" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = auditLogQuerySchema.parse({
      userId: searchParams.get("userId") || undefined,
      action: searchParams.get("action") || undefined,
      resourceType: searchParams.get("resourceType") || undefined,
      dateFrom: searchParams.get("dateFrom") || undefined,
      dateTo: searchParams.get("dateTo") || undefined,
    });

    // Build where clause
    const where: any = {
      workspaceId: session.user.workspaceId,
    };

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.action) {
      where.action = query.action;
    }

    if (query.resourceType) {
      where.resourceType = query.resourceType;
    }

    if (query.dateFrom || query.dateTo) {
      where.timestamp = {};
      if (query.dateFrom) {
        const fromDate = new Date(query.dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        where.timestamp.gte = fromDate;
      }
      if (query.dateTo) {
        const toDate = new Date(query.dateTo);
        toDate.setHours(23, 59, 59, 999);
        where.timestamp.lte = toDate;
      }
    }

    // Fetch all audit events matching filters
    const events = await db.auditEvent.findMany({
      where,
      orderBy: {
        timestamp: "desc",
      },
      include: {
        meeting: {
          select: {
            id: true,
            clientName: true,
            meetingDate: true,
          },
        },
      },
    });

    // Fetch user details
    const userIds = [...new Set(events.map((e) => e.userId))];
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

    // Generate CSV
    const csvRows = [
      // Header
      ["Timestamp", "User", "Action", "Resource Type", "Resource ID", "Meeting", "Metadata"].join(","),
    ];

    for (const event of events) {
      const user = userMap.get(event.userId);
      const userName = user?.name || user?.email || event.userId;
      const meetingInfo = event.meeting
        ? `${event.meeting.clientName} (${new Date(event.meeting.meetingDate).toLocaleDateString()})`
        : "";
      const metadata = event.metadata ? JSON.stringify(event.metadata).replace(/"/g, '""') : "";

      const row = [
        event.timestamp.toISOString(),
        `"${userName}"`,
        event.action,
        event.resourceType,
        event.resourceId,
        `"${meetingInfo}"`,
        `"${metadata}"`,
      ].join(",");

      csvRows.push(row);
    }

    const csv = csvRows.join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="audit-logs-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Error exporting audit logs:", error);
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid query parameters", details: error.errors }, { status: 400 });
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "An unknown error occurred" },
      { status: 500 }
    );
  }
}

