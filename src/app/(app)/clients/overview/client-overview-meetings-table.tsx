"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  DataTable,
  type TableColumn,
} from "~/components/ui/data-table/index";

export type ClientOverviewMeetingRow = {
  id: string;
  date: string;
  type: string;
  keywords: string;
  hasRecommendations: boolean;
  isFinalized: boolean;
  supervisoryOutcome: string | null;
  outcomeReason: string | null;
};

type ClientOverviewMeetingsTableProps = {
  rows: ClientOverviewMeetingRow[];
};

function outcomeLabel(outcome: string | null): string {
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
}

function outcomeVariant(
  outcome: string | null,
): "default" | "secondary" | "destructive" | "outline" {
  if (outcome === "ESCALATED") return "destructive";
  if (outcome === "HELD") return "secondary";
  return "outline";
}

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function ClientOverviewMeetingsTable({
  rows,
}: ClientOverviewMeetingsTableProps): React.JSX.Element {
  const columns = useMemo((): TableColumn<ClientOverviewMeetingRow>[] => {
    return [
      {
        key: "date",
        header: "Date",
        sortable: true,
        width: "7rem",
        sortValue: (row) => row.date,
        cell: (row) => dateFmt.format(new Date(row.date)),
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
            variant={outcomeVariant(row.supervisoryOutcome)}
            title={row.outcomeReason ?? undefined}
          >
            {outcomeLabel(row.supervisoryOutcome)}
          </Badge>
        ),
      },
      {
        key: "recommendations",
        header: "Recommendations",
        width: "6.5rem",
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

  return (
    <DataTable
      data={rows}
      columns={columns}
      getRowId={(row) => row.id}
      defaultSort={{ key: "date", direction: "desc" }}
      rowHeight={52}
      height={480}
      overscan={8}
      emptyState="No interactions for this client."
      className="rounded-md border"
    />
  );
}
