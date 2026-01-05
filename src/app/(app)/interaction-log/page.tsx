import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { redirect } from "next/navigation";
import InteractionLogClient from "./interaction-log-client";

// Force dynamic rendering since we use searchParams
export const dynamic = "force-dynamic";

export default async function InteractionLogPage({
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
  const dateFrom = typeof params.dateFrom === "string" ? params.dateFrom : undefined;
  const dateTo = typeof params.dateTo === "string" ? params.dateTo : undefined;
  const meetingType = typeof params.type === "string" ? params.type : undefined;
  const keywords = typeof params.keywords === "string" ? params.keywords : undefined;
  const hasRecommendations = typeof params.recommendations === "string" ? params.recommendations : undefined;
  const isFinalized = typeof params.finalized === "string" ? params.finalized : undefined;
  const sortBy = typeof params.sortBy === "string" ? params.sortBy : "date";
  const sortOrder = typeof params.sortOrder === "string" ? params.sortOrder : "desc";

  const workspaceId = session.user.workspaceId;

  // Build where clause
  const where: any = {
    workspaceId,
  };

  if (clientName) {
    where.clientName = {
      contains: clientName,
      mode: "insensitive",
    };
  }

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

  if (meetingType) {
    where.meetingType = meetingType;
  }

  if (isFinalized === "yes") {
    where.status = "FINALIZED";
  } else if (isFinalized === "no") {
    where.status = { not: "FINALIZED" };
  }

  // Build orderBy
  const orderBy: any = {};
  if (sortBy === "client") {
    orderBy.clientName = sortOrder;
  } else if (sortBy === "date") {
    orderBy.meetingDate = sortOrder;
  } else if (sortBy === "type") {
    orderBy.meetingType = sortOrder;
  } else {
    orderBy.meetingDate = "desc";
  }

  // Fetch meetings
  let meetings = await db.meeting.findMany({
    where,
    select: {
      id: true,
      clientName: true,
      meetingDate: true,
      meetingType: true,
      status: true,
      extraction: true,
    },
    orderBy,
  });

  // Filter by keywords and recommendations in memory (for v1)
  if (keywords) {
    const keywordsLower = keywords.toLowerCase();
    meetings = meetings.filter((meeting) => {
      if (!meeting.extraction) return false;
      const extraction = meeting.extraction as {
        topics?: string[];
        recommendations?: Array<{ text?: string }>;
        disclosures?: Array<{ text?: string }>;
        decisions?: Array<{ text?: string }>;
        followUps?: Array<{ text?: string }>;
      };

      const allText = [
        ...(extraction.topics || []),
        ...(extraction.recommendations?.map((r) => r.text || "") || []),
        ...(extraction.disclosures?.map((d) => d.text || "") || []),
        ...(extraction.decisions?.map((d) => d.text || "") || []),
        ...(extraction.followUps?.map((f) => f.text || "") || []),
      ].join(" ").toLowerCase();

      return allText.includes(keywordsLower);
    });
  }

  if (hasRecommendations === "yes") {
    meetings = meetings.filter((meeting) => {
      if (!meeting.extraction) return false;
      const extraction = meeting.extraction as {
        recommendations?: Array<{ text?: string }>;
      };
      return (extraction.recommendations?.length ?? 0) > 0;
    });
  } else if (hasRecommendations === "no") {
    meetings = meetings.filter((meeting) => {
      if (!meeting.extraction) return true;
      const extraction = meeting.extraction as {
        recommendations?: Array<{ text?: string }>;
      };
      return (extraction.recommendations?.length ?? 0) === 0;
    });
  }

  // Format meetings for client
  const formattedMeetings = meetings.map((meeting) => {
    const extraction = meeting.extraction as {
      topics?: string[];
      recommendations?: Array<{ text?: string }>;
    } | null;

    // Extract keywords from topics
    const keywordsList = extraction?.topics || [];

    // Check if has recommendations
    const hasRecommendations = (extraction?.recommendations?.length ?? 0) > 0;

    return {
      id: meeting.id,
      clientName: meeting.clientName,
      date: meeting.meetingDate.toISOString(),
      type: meeting.meetingType,
      keywords: keywordsList.join(", "),
      hasRecommendations,
      isFinalized: meeting.status === "FINALIZED",
    };
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Interaction Log</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          View all client interactions in your workspace
        </p>
      </div>

      <InteractionLogClient
        initialMeetings={formattedMeetings}
        initialFilters={{
          clientName: clientName || "",
          dateFrom: dateFrom || "",
          dateTo: dateTo || "",
          type: meetingType || "",
          keywords: keywords || "",
          recommendations: hasRecommendations || "",
          finalized: isFinalized || "",
          sortBy,
          sortOrder,
        }}
      />
    </div>
  );
}

