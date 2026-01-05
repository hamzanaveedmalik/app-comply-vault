import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import Link from "next/link";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import ReviewQueueClient from "./review-queue-client";

// Force dynamic rendering since we use searchParams
export const dynamic = "force-dynamic";

export default async function ReviewQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();

  if (!session?.user?.workspaceId) {
    redirect("/workspaces/new");
  }

  try {
    const params = await searchParams;
    const clientName = typeof params.clientName === "string" ? params.clientName.trim() : undefined;
    const status = typeof params.status === "string" ? params.status : undefined;
    const dateFrom = typeof params.dateFrom === "string" ? params.dateFrom : undefined;
    const dateTo = typeof params.dateTo === "string" ? params.dateTo : undefined;

    // Build where clause
    const where: any = {
      workspaceId: session.user.workspaceId,
    };

    // Status filter - if specific status provided, use it; otherwise filter for DRAFT_READY or DRAFT
    if (status && (status === "DRAFT_READY" || status === "DRAFT")) {
      where.status = status;
    } else {
      where.status = {
        in: ["DRAFT_READY", "DRAFT"],
      };
    }

    // Client name filter - use case-insensitive search (PostgreSQL supports this)
    if (clientName && clientName.length > 0) {
      where.clientName = {
        contains: clientName,
        mode: "insensitive",
      };
    }

    // Date range filter
    if (dateFrom || dateTo) {
      where.meetingDate = {};
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        where.meetingDate.gte = fromDate;
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        where.meetingDate.lte = toDate;
      }
    }

    // Fetch meetings
    const meetings = await db.meeting.findMany({
      where,
      orderBy: {
        updatedAt: "desc",
      },
    });

    // Get last edited info from version history and uploader info
    const meetingsWithLastEdited = await Promise.all(
      meetings.map(async (meeting) => {
        try {
          // Get upload event
          const uploadEvent = await db.auditEvent.findFirst({
            where: {
              meetingId: meeting.id,
              action: "UPLOAD",
            },
            orderBy: {
              timestamp: "desc",
            },
          });

          // Get uploader user if upload event exists
          let uploader = null;
          if (uploadEvent?.userId) {
            try {
              const user = await db.user.findUnique({
                where: { id: uploadEvent.userId },
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              });
              if (user) {
                uploader = user;
              }
            } catch (err) {
              console.error(`Error fetching user ${uploadEvent.userId}:`, err);
            }
          }

          // Get last version
          const lastVersion = await db.version.findFirst({
            where: { meetingId: meeting.id },
            orderBy: { timestamp: "desc" },
          });

          return {
            id: meeting.id,
            clientName: meeting.clientName,
            meetingDate: meeting.meetingDate.toISOString(),
            meetingType: meeting.meetingType,
            status: meeting.status,
            readyForCCO: meeting.readyForCCO,
            uploadedBy: uploader
              ? {
                  id: uploader.id,
                  name: uploader.name || uploader.email || "Unknown",
                  email: uploader.email,
                }
              : null,
            lastEdited: lastVersion
              ? {
                  timestamp: lastVersion.timestamp.toISOString(),
                  editorId: lastVersion.editorId,
                }
              : null,
            draftReadyAt: meeting.draftReadyAt?.toISOString() || null,
          };
        } catch (err) {
          console.error(`Error processing meeting ${meeting.id}:`, err);
          // Return basic meeting info even if we can't get uploader/version info
          return {
            id: meeting.id,
            clientName: meeting.clientName,
            meetingDate: meeting.meetingDate.toISOString(),
            meetingType: meeting.meetingType,
            status: meeting.status,
            readyForCCO: meeting.readyForCCO,
            uploadedBy: null,
            lastEdited: null,
            draftReadyAt: meeting.draftReadyAt?.toISOString() || null,
          };
        }
      })
    );

    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Review Queue</h1>
          <p className="text-muted-foreground mt-2">
            Review and edit draft meeting records
          </p>
        </div>

        <ReviewQueueClient
          initialMeetings={meetingsWithLastEdited}
          initialFilters={{
            clientName: clientName || "",
            status: status || "",
            dateFrom: dateFrom || "",
            dateTo: dateTo || "",
          }}
        />
      </div>
    );
  } catch (error) {
    console.error("Error loading review queue:", error);
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Review Queue</h1>
          <p className="text-muted-foreground mt-2">
            Review and edit draft meeting records
          </p>
        </div>
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <p className="text-destructive">
            An error occurred while loading the review queue. Please try again later.
          </p>
        </div>
      </div>
    );
  }
}

