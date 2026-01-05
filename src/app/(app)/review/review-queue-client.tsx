"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import Link from "next/link";

interface Meeting {
  id: string;
  clientName: string;
  meetingDate: string; // ISO string
  meetingType: string;
  status: string;
  uploadedBy: {
    id: string;
    name: string;
    email: string | null;
  } | null;
  lastEdited: {
    timestamp: string; // ISO string
    editorId: string;
  } | null;
  draftReadyAt: string | null; // ISO string
}

interface ReviewQueueClientProps {
  initialMeetings: Meeting[];
  initialFilters: {
    clientName: string;
    status: string;
    dateFrom: string;
    dateTo: string;
  };
  getStatusVariant: (status: string) => "default" | "secondary" | "destructive" | "outline";
  getStatusLabel: (status: string) => string;
}

export default function ReviewQueueClient({
  initialMeetings,
  initialFilters,
  getStatusVariant,
  getStatusLabel,
}: ReviewQueueClientProps) {
  const router = useRouter();
  const [meetings] = useState<Meeting[]>(initialMeetings);
  const [filters, setFilters] = useState(initialFilters);

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);

    // Build query string
    const params = new URLSearchParams();
    if (newFilters.clientName) params.set("clientName", newFilters.clientName);
    if (newFilters.status) params.set("status", newFilters.status);
    if (newFilters.dateFrom) params.set("dateFrom", newFilters.dateFrom);
    if (newFilters.dateTo) params.set("dateTo", newFilters.dateTo);

    router.push(`/review?${params.toString()}`);
  };

  const clearFilters = () => {
    setFilters({
      clientName: "",
      status: "",
      dateFrom: "",
      dateTo: "",
    });
    router.push("/review");
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label htmlFor="clientName">Client Name</Label>
              <Input
                id="clientName"
                value={filters.clientName}
                onChange={(e) => handleFilterChange("clientName", e.target.value)}
                placeholder="Search by client..."
              />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={filters.status}
                onValueChange={(value) => handleFilterChange("status", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All statuses</SelectItem>
                  <SelectItem value="DRAFT_READY">Draft Ready</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="dateFrom">Date From</Label>
              <Input
                id="dateFrom"
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="dateTo">Date To</Label>
              <Input
                id="dateTo"
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange("dateTo", e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4">
            <Button variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Meetings List */}
      <Card>
        <CardHeader>
          <CardTitle>
            Meetings ({meetings.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {meetings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No meetings found matching your filters.
            </div>
          ) : (
            <div className="space-y-4">
              {meetings.map((meeting) => (
                <Card key={meeting.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Link
                            href={`/meetings/${meeting.id}`}
                            className="font-semibold hover:underline"
                          >
                            {meeting.clientName}
                          </Link>
                          <Badge variant={getStatusVariant(meeting.status)}>
                            {getStatusLabel(meeting.status)}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <div>
                            <span className="font-medium">Date:</span>{" "}
                            {new Date(meeting.meetingDate).toLocaleDateString()}
                          </div>
                          <div>
                            <span className="font-medium">Type:</span> {meeting.meetingType}
                          </div>
                          {meeting.uploadedBy && (
                            <div>
                              <span className="font-medium">Uploaded by:</span>{" "}
                              {meeting.uploadedBy.name}
                            </div>
                          )}
                          {meeting.lastEdited && (
                            <div>
                              <span className="font-medium">Last edited:</span>{" "}
                              {new Date(meeting.lastEdited.timestamp).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <Link href={`/meetings/${meeting.id}`}>
                          <Button variant="outline">Review</Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

