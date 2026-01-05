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

export default async function ReviewQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();

  if (!session?.user?.workspaceId) {
    redirect("/workspaces/new");
  }

  const params = await searchParams;
  const clientName = typeof params.clientName === "string" ? params.clientName : undefined;
  const status = typeof params.status === "string" ? params.status : undefined;
  const dateFrom = typeof params.dateFrom === "string" ? params.dateFrom : undefined;
  const dateTo = typeof params.dateTo === "string" ? params.dateTo : undefined;

  // Build where clause
  const where: any = {
    workspaceId: session.user.workspaceId,
    status: {
      in: ["DRAFT_READY", "DRAFT"],
    },
  };

  if (clientName) {
    where.clientName = {
      contains: clientName,
      mode: "insensitive",
    };
  }

  if (status && (status === "DRAFT_READY" || status === "DRAFT")) {
    where.status = status;
  }

  if (dateFrom || dateTo) {
    where.meetingDate = {};
    if (dateFrom) {
      where.meetingDate.gte = new Date(dateFrom);
    }
    if (dateTo) {
      where.meetingDate.lte = new Date(dateTo);
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
    })
  );

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "DRAFT_READY":
        return "default";
      case "DRAFT":
        return "outline";
      default:
        return "secondary";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "DRAFT_READY":
        return "Draft Ready";
      case "DRAFT":
        return "Draft";
      default:
        return status;
    }
  };

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
        getStatusVariant={getStatusVariant}
        getStatusLabel={getStatusLabel}
      />
    </div>
  );
}

