"use client";

import { useMemo, useState } from "react";
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
import { Badge } from "~/components/ui/badge";
import { SupersessionBadge } from "~/components/meetings/supersession-badge";
import {
  DataTable,
  type SortState,
  type TableColumn,
} from "~/components/ui/data-table/index";

interface InteractionLogMeeting {
  id: string;
  clientName: string;
  date: string;
  type: string;
  keywords: string;
  hasRecommendations: boolean;
  isFinalized: boolean;
  supersededById: string | null;
  supersedesId: string | null;
  supervisoryOutcome: string | null;
  outcomeReason: string | null;
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
    outcome: string;
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

  const handleSortChange = (sort: SortState | null): void => {
    if (!sort) return;
    const newFilters = {
      ...filters,
      sortBy: sort.key,
      sortOrder: sort.direction,
    };
    setFilters(newFilters);
    const params = new URLSearchParams();
    Object.entries(newFilters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    router.push(`/interaction-log?${params.toString()}`);
  };

  const sortState: SortState = {
    key: filters.sortBy || "date",
    direction: filters.sortOrder === "asc" ? "asc" : "desc",
  };

  const outcomeLabel = (outcome: string | null): string => {
    switch (outcome) {
      case "CLEARED":
        return "Cleared";
      case "ROUTINE_SAMPLE":
        return "Sampled";
      case "ESCALATED":
        return "Escalated";
      case "HELD":
        return "Held";
      case "PARKED":
        return "Parked";
      default:
        return "Unassigned";
    }
  };

  const columns = useMemo((): TableColumn<InteractionLogMeeting>[] => {
    return [
      {
        key: "client",
        header: "Client",
        sortable: true,
        width: "11rem",
        sortValue: (row) => row.clientName,
        cell: (row) => (
          <div className="flex flex-col gap-1">
            <span className="font-medium">{row.clientName}</span>
            <SupersessionBadge
              supersededById={row.supersededById}
              supersedesId={row.supersedesId}
            />
          </div>
        ),
      },
      {
        key: "date",
        header: "Date",
        sortable: true,
        width: "6.5rem",
        sortValue: (row) => row.date,
        cell: (row) => new Date(row.date).toLocaleDateString(),
      },
      {
        key: "type",
        header: "Type",
        sortable: true,
        width: "8rem",
        sortValue: (row) => row.type,
        cell: (row) => row.type,
      },
      {
        key: "keywords",
        header: "Keywords",
        width: "10rem",
        cell: (row) => (
          <span className="block max-w-[10rem] truncate text-sm text-muted-foreground">
            {row.keywords || "—"}
          </span>
        ),
      },
      {
        key: "outcome",
        header: "Outcome",
        width: "7rem",
        cell: (row) => (
          <Badge
            variant={
              row.supervisoryOutcome === "ESCALATED"
                ? "destructive"
                : row.supervisoryOutcome === "HELD"
                  ? "secondary"
                  : "outline"
            }
            title={row.outcomeReason ?? undefined}
          >
            {outcomeLabel(row.supervisoryOutcome)}
          </Badge>
        ),
      },
      {
        key: "recommendations",
        header: "Recommendations",
        width: "6rem",
        align: "center",
        cell: (row) => (
          <Badge variant={row.hasRecommendations ? "default" : "secondary"}>
            {row.hasRecommendations ? "Yes" : "No"}
          </Badge>
        ),
      },
      {
        key: "finalized",
        header: "Finalized",
        width: "5.5rem",
        align: "center",
        cell: (row) => (
          <Badge variant={row.isFinalized ? "default" : "outline"}>
            {row.isFinalized ? "Yes" : "No"}
          </Badge>
        ),
      },
      {
        key: "actions",
        header: "Actions",
        width: "5rem",
        align: "right",
        cell: (row) => (
          <Button variant="link" asChild className="h-auto p-0">
            <Link href={`/meetings/${row.id}`}>View</Link>
          </Button>
        ),
      },
    ];
  }, []);

  const clearFilters = (): void => {
    setFilters({
      clientName: "",
      dateFrom: "",
      dateTo: "",
      type: "",
      keywords: "",
      recommendations: "",
      finalized: "",
      outcome: "",
      sortBy: "date",
      sortOrder: "desc",
    });
    router.push("/interaction-log");
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex min-w-0 flex-col gap-2">
              <Label htmlFor="clientName">Client Name</Label>
              <Input
                id="clientName"
                value={filters.clientName}
                onChange={(e) => handleFilterChange("clientName", e.target.value)}
                placeholder="Search by client..."
              />
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <Label htmlFor="dateFrom">Date From</Label>
              <Input
                id="dateFrom"
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <Label htmlFor="dateTo">Date To</Label>
              <Input
                id="dateTo"
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange("dateTo", e.target.value)}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <Label htmlFor="type">Meeting Type</Label>
              <Input
                id="type"
                value={filters.type}
                onChange={(e) => handleFilterChange("type", e.target.value)}
                placeholder="e.g., Annual Review"
              />
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <Label htmlFor="keywords">Keywords</Label>
              <Input
                id="keywords"
                value={filters.keywords}
                onChange={(e) => handleFilterChange("keywords", e.target.value)}
                placeholder="Search keywords..."
              />
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <Label htmlFor="recommendations">Recommendations</Label>
              <Select
                value={filters.recommendations || "all"}
                onValueChange={(value) =>
                  handleFilterChange("recommendations", value === "all" ? "" : value)
                }
              >
                <SelectTrigger id="recommendations" className="w-full">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <Label htmlFor="finalized">Finalized</Label>
              <Select
                value={filters.finalized || "all"}
                onValueChange={(value) =>
                  handleFilterChange("finalized", value === "all" ? "" : value)
                }
              >
                <SelectTrigger id="finalized" className="w-full">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <Label htmlFor="outcome">Supervisory outcome</Label>
              <Select
                value={filters.outcome || "all"}
                onValueChange={(value) =>
                  handleFilterChange("outcome", value === "all" ? "" : value)
                }
              >
                <SelectTrigger id="outcome" className="w-full">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="CLEARED">Cleared</SelectItem>
                  <SelectItem value="ROUTINE_SAMPLE">Routine sample</SelectItem>
                  <SelectItem value="ESCALATED">Escalated</SelectItem>
                  <SelectItem value="HELD">Held</SelectItem>
                  <SelectItem value="PARKED">Parked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Button variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
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
          <DataTable
            data={initialMeetings}
            columns={columns}
            getRowId={(row) => row.id}
            sort={sortState}
            onSortChange={handleSortChange}
            rowHeight={52}
            height={560}
            overscan={8}
            emptyState="No interactions found matching your filters."
            className="rounded-md border"
          />
        </CardContent>
      </Card>
    </div>
  );
}

