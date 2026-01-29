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
      "MEMBER_REMOVED",
    ])
    .optional(),
  resourceType: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  limit: z.coerce.number().min(1).max(1000).optional().default(100),
  offset: z.coerce.number().min(0).optional().default(0),
});

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.workspaceId || !session.user.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only OWNER_CCO can view audit logs
    if (session.user.role !== "OWNER_CCO") {
      return Response.json(
        { error: "Forbidden: Only workspace owners can view audit logs" },
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
      limit: searchParams.get("limit") || undefined,
      offset: searchParams.get("offset") || undefined,
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

    // Fetch audit events with user details
    const [events, total] = await Promise.all([
      db.auditEvent.findMany({
        where,
        orderBy: {
          timestamp: "desc",
        },
        take: query.limit,
        skip: query.offset,
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

    // Fetch user details for events
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

    // Format response
    const formattedEvents = events.map((event) => ({
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
      meeting: event.meeting,
    }));

    return Response.json({
      events: formattedEvents,
      total,
      limit: query.limit,
      offset: query.offset,
    });
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid query parameters", details: error.errors }, { status: 400 });
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "An unknown error occurred" },
      { status: 500 }
    );
  }
}

