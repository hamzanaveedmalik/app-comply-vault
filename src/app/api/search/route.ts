import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { NextResponse } from "next/server";
import { measurePerformance, QueryOptimizations } from "~/server/performance";

interface SearchResult {
  id: string;
  clientName: string;
  meetingDate: string;
  status: string;
  type: string;
  matchType?: "client" | "date" | "keyword" | "transcript" | "field";
  snippet?: string;
}

export async function GET(request: Request) {
  return measurePerformance("Search operation", async () => {
    try {
      const session = await auth();

      if (!session?.user?.workspaceId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const { searchParams } = new URL(request.url);
      const query = searchParams.get("q")?.trim() || "";

      if (query.length < 2) {
        return NextResponse.json({ results: [] });
      }

      const workspaceId = session.user.workspaceId;
      const results: SearchResult[] = [];

    // Parse date range (format: "2024-01-01 to 2024-12-31" or "2024-01-01-2024-12-31")
    const dateRangeMatch = query.match(/(\d{4}-\d{2}-\d{2})\s*(?:to|-)\s*(\d{4}-\d{2}-\d{2})/i);
    if (dateRangeMatch) {
      const startDate = new Date(dateRangeMatch[1]!);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(dateRangeMatch[2]!);
      endDate.setHours(23, 59, 59, 999);

      const meetings = await db.meeting.findMany({
        where: {
          workspaceId,
          meetingDate: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          id: true,
          clientName: true,
          meetingDate: true,
          status: true,
          meetingType: true,
        },
        take: 20,
        orderBy: {
          meetingDate: "desc",
        },
      });

      results.push(
        ...meetings.map((meeting) => ({
          id: meeting.id,
          clientName: meeting.clientName,
          meetingDate: meeting.meetingDate.toISOString(),
          status: meeting.status,
          type: meeting.meetingType,
          matchType: "date" as const,
        }))
      );
    } else {
      // Search by client name (case-insensitive, partial match)
      // This should match "eman" to "Eman Hamza"
      console.log(`[Search] Searching for client name: "${query}" in workspace ${workspaceId}`);
      
      const clientNameResults = await db.meeting.findMany({
        where: {
          workspaceId,
          clientName: {
            contains: query,
            mode: "insensitive",
          },
        },
        select: {
          id: true,
          clientName: true,
          meetingDate: true,
          status: true,
          meetingType: true,
        },
        take: 20,
        orderBy: {
          meetingDate: "desc",
        },
      });

      console.log(`[Search] Found ${clientNameResults.length} client name matches:`, 
        clientNameResults.map((m) => `${m.clientName} (${m.id})`));

      results.push(
        ...clientNameResults.map((meeting) => ({
          id: meeting.id,
          clientName: meeting.clientName,
          meetingDate: meeting.meetingDate.toISOString(),
          status: meeting.status,
          type: meeting.meetingType,
          matchType: "client" as const,
        }))
      );

      // Keyword search using indexed searchableText (Story 7.4)
      const queryLower = query.toLowerCase();
      const keywordMeetings = await db.meeting.findMany({
        where: {
          workspaceId,
          searchableText: {
            contains: queryLower,
            mode: "insensitive",
          },
        },
        select: {
          id: true,
          clientName: true,
          meetingDate: true,
          status: true,
          meetingType: true,
          transcript: true,
          extraction: true,
          searchableText: true,
        },
        take: 10,
        orderBy: {
          meetingDate: "desc",
        },
      });

      // Extract snippets from matching meetings
      for (const meeting of keywordMeetings) {
        let snippet: string | undefined;
        let matchType: "transcript" | "field" = "transcript";

        // Try to find matching segment in transcript
        if (meeting.transcript) {
          const transcript = meeting.transcript as {
            segments?: Array<{ text?: string; startTime?: number; endTime?: number }>;
          };
          if (transcript.segments) {
            const matchingSegment = transcript.segments.find((seg) =>
              seg.text?.toLowerCase().includes(queryLower)
            );
            if (matchingSegment?.text) {
              snippet = matchingSegment.text.substring(0, 100);
              matchType = "transcript";
            }
          }
        }

        // If no transcript match, try extraction fields
        if (!snippet && meeting.extraction) {
          const extraction = meeting.extraction as {
            topics?: string[];
            recommendations?: Array<{ text?: string }>;
            disclosures?: Array<{ text?: string }>;
            decisions?: Array<{ text?: string }>;
            followUps?: Array<{ text?: string }>;
          };

          const allFields = [
            ...(extraction.topics || []),
            ...(extraction.recommendations?.map((r) => r.text || "") || []),
            ...(extraction.disclosures?.map((d) => d.text || "") || []),
            ...(extraction.decisions?.map((d) => d.text || "") || []),
            ...(extraction.followUps?.map((f) => f.text || "") || []),
          ];

          const matchingField = allFields.find((field) =>
            field.toLowerCase().includes(queryLower)
          );

          if (matchingField) {
            snippet = matchingField.substring(0, 100);
            matchType = "field";
          }
        }

        // Fallback to searchableText snippet if no specific match found
        if (!snippet && meeting.searchableText) {
          const index = meeting.searchableText.toLowerCase().indexOf(queryLower);
          if (index >= 0) {
            const start = Math.max(0, index - 20);
            snippet = meeting.searchableText.substring(start, start + 100);
          }
        }

        // Check if already in results
        if (!results.find((r) => r.id === meeting.id)) {
          results.push({
            id: meeting.id,
            clientName: meeting.clientName,
            meetingDate: meeting.meetingDate.toISOString(),
            status: meeting.status,
            type: meeting.meetingType,
            matchType,
            snippet: snippet || undefined,
          });
        }
      }
    }

    // Remove duplicates and limit to 20 results
    const uniqueResults = Array.from(
      new Map(results.map((r) => [r.id, r])).values()
    ).slice(0, 20);

    // Log search results for debugging (only in development)
    if (process.env.NODE_ENV === "development") {
      console.log(`Search query: "${query}", Results: ${uniqueResults.length}`, {
        clientNameMatches: results.filter((r) => r.matchType === "client").length,
        keywordMatches: results.filter((r) => r.matchType === "transcript" || r.matchType === "field").length,
      });
    }

    return NextResponse.json({ results: uniqueResults });
    } catch (error) {
      console.error("Search error:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  });
}

