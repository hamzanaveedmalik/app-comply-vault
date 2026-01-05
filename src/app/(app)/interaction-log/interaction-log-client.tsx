"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

interface InteractionLogMeeting {
  id: string;
  clientName: string;
  date: string;
  type: string;
  keywords: string;
  hasRecommendations: boolean;
  isFinalized: boolean;
}

interface InteractionLogClientProps {
  initialMeetings: InteractionLogMeeting[];
  initialFilters: {
    clientName: string;
    dateFrom: string;
    dateTo: string;
    type: string;
    keywords: string;
    recommendations: string;
    finalized: string;
    sortBy: string;
    sortOrder: string;
  };
}

export default function InteractionLogClient({
  initialMeetings,
  initialFilters,
}: InteractionLogClientProps) {
  const router = useRouter();
  const [filters, setFilters] = useState(initialFilters);

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);

    const params = new URLSearchParams();
    Object.entries(newFilters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });

    router.push(`/interaction-log?${params.toString()}`);
  };

  const handleSort = (column: string) => {
    const newSortOrder =
      filters.sortBy === column && filters.sortOrder === "asc" ? "desc" : "asc";
    handleFilterChange("sortBy", column);
    handleFilterChange("sortOrder", newSortOrder);
  };

  const clearFilters = () => {
    setFilters({
      clientName: "",
      dateFrom: "",
      dateTo: "",
      type: "",
      keywords: "",
      recommendations: "",
      finalized: "",
      sortBy: "date",
      sortOrder: "desc",
    });
    router.push("/interaction-log");
  };

  const getSortIcon = (column: string) => {
    if (filters.sortBy !== column) {
      return <ArrowUpDown className="ml-1 h-3 w-3" />;
    }
    return filters.sortOrder === "asc" ? (
      <ArrowUp className="ml-1 h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3" />
    );
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
            <div>
              <Label htmlFor="type">Meeting Type</Label>
              <Input
                id="type"
                value={filters.type}
                onChange={(e) => handleFilterChange("type", e.target.value)}
                placeholder="e.g., Annual Review"
              />
            </div>
            <div>
              <Label htmlFor="keywords">Keywords</Label>
              <Input
                id="keywords"
                value={filters.keywords}
                onChange={(e) => handleFilterChange("keywords", e.target.value)}
                placeholder="Search keywords..."
              />
            </div>
            <div>
              <Label htmlFor="recommendations">Recommendations</Label>
              <Select
                value={filters.recommendations || "all"}
                onValueChange={(value) =>
                  handleFilterChange("recommendations", value === "all" ? "" : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="finalized">Finalized</Label>
              <Select
                value={filters.finalized || "all"}
                onValueChange={(value) =>
                  handleFilterChange("finalized", value === "all" ? "" : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={clearFilters} className="w-full">
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Interaction Log Table */}
      <Card>
        <CardHeader>
          <CardTitle>Interactions ({initialMeetings.length})</CardTitle>
          <CardDescription>
            All client interactions in your workspace
          </CardDescription>
        </CardHeader>
        <CardContent>
          {initialMeetings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No interactions found matching your filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <button
                        onClick={() => handleSort("client")}
                        className="flex items-center hover:text-foreground"
                      >
                        Client
                        {getSortIcon("client")}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort("date")}
                        className="flex items-center hover:text-foreground"
                      >
                        Date
                        {getSortIcon("date")}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort("type")}
                        className="flex items-center hover:text-foreground"
                      >
                        Type
                        {getSortIcon("type")}
                      </button>
                    </TableHead>
                    <TableHead>Keywords</TableHead>
                    <TableHead>Recommendations</TableHead>
                    <TableHead>Finalized</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {initialMeetings.map((meeting) => (
                    <TableRow key={meeting.id}>
                      <TableCell className="font-medium">
                        {meeting.clientName}
                      </TableCell>
                      <TableCell>
                        {new Date(meeting.date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{meeting.type}</TableCell>
                      <TableCell>
                        <div className="max-w-xs truncate text-sm text-muted-foreground">
                          {meeting.keywords || "—"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={meeting.hasRecommendations ? "default" : "secondary"}>
                          {meeting.hasRecommendations ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={meeting.isFinalized ? "default" : "outline"}>
                          {meeting.isFinalized ? "Yes" : "No"}
                        </Badge>
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

