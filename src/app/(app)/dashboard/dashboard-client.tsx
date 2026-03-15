"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { toast } from "sonner";

interface Meeting {
  id: string;
  clientName: string;
  meetingType: string;
  meetingDate: string;
  status: string;
  createdAt: string;
}

interface DashboardClientProps {
  initialMeetings: Meeting[];
}

export function DashboardClient({ initialMeetings }: DashboardClientProps) {
  const router = useRouter();
  const [meetings, setMeetings] = useState(initialMeetings);

  // Poll for status changes on PROCESSING meetings
  useEffect(() => {
    const processingMeetings = meetings.filter((m) => m.status === "PROCESSING" || m.status === "UPLOADING");
    
    if (processingMeetings.length === 0) {
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        // Check each processing meeting
        for (const meeting of processingMeetings) {
          const response = await fetch(`/api/meetings/${meeting.id}/status`);
          if (!response.ok) continue;

          const data = await response.json();
          if (data.status !== meeting.status) {
            // Status changed - update local state and show toast
            setMeetings((prev) =>
              prev.map((m) =>
                m.id === meeting.id ? { ...m, status: data.status } : m
              )
            );

            if (data.status === "DRAFT_READY") {
              toast.success("Meeting Processing Complete", {
                description: `${meeting.clientName} is ready for review`,
                action: {
                  label: "View",
                  onClick: () => router.push(`/meetings/${meeting.id}`),
                },
              });
            }

            // Refresh the page to get updated metrics
            router.refresh();
          }
        }
      } catch (error) {
        console.error("Error polling meeting statuses:", error);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [meetings, router]);

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
      case "FINALIZED":
        return "default";
      default:
        return "secondary";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "UPLOADING":
        return "Queued";
      case "PROCESSING":
        return "Processing";
      case "DRAFT_READY":
        return "Ready for review";
      case "DRAFT":
        return "In review";
      case "FINALIZED":
        return "Finalized";
      default:
        return status;
    }
  };

  const isProcessing = (status: string) =>
    status === "PROCESSING" || status === "UPLOADING";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Meetings</CardTitle>
        <CardDescription>
          A list of all your meeting recordings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client Name</TableHead>
              <TableHead>Meeting Type</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {meetings.map((meeting) => (
              <TableRow key={meeting.id}>
                <TableCell className="font-medium">
                  {meeting.clientName}
                </TableCell>
                <TableCell>{meeting.meetingType}</TableCell>
                <TableCell>
                  {new Date(meeting.meetingDate).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={getStatusVariant(meeting.status)}
                    className={isProcessing(meeting.status) ? "gap-1.5" : ""}
                  >
                    {isProcessing(meeting.status) && (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    )}
                    {getStatusLabel(meeting.status)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {new Date(meeting.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="link" asChild>
                    <Link href={`/meetings/${meeting.id}`}>View</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

