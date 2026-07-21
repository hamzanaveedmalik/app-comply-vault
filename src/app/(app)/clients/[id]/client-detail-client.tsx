import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Hash, History, Mail } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import type { ClientDetailDto } from "~/lib/types/clients";

type ClientDetailClientProps = {
  detail: ClientDetailDto;
};

function directionLabel(direction: string | null): string {
  if (direction === "OUTBOUND") return "Sent";
  if (direction === "INTERNAL") return "Internal";
  return "Received";
}

function shortHash(hash: string | null): string {
  if (!hash) return "—";
  return `${hash.slice(0, 8)}…`;
}

export function ClientDetailClient({
  detail,
}: ClientDetailClientProps): React.JSX.Element {
  const dateFmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:underline">
            Clients
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-[#0D2818]">{detail.name}</span>
        </p>
        <h1 className="text-2xl font-semibold text-[#0D2818]">{detail.name}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <Badge variant="secondary">{detail.status}</Badge>
          <span>
            Last contact:{" "}
            {detail.lastContactAt
              ? dateFmt.format(new Date(detail.lastContactAt))
              : "—"}
          </span>
          <span>
            Correspondence ({detail.periodLabel}): {detail.correspondenceCountPeriod}
          </span>
        </div>
        {detail.householdMembers.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            Household:{" "}
            {detail.householdMembers
              .map((m) => `${m.name} (${m.role.toLowerCase()})`)
              .join(", ")}
          </p>
        ) : null}
      </header>

      <section className="space-y-3" aria-labelledby="correspondence-heading">
        <h2
          id="correspondence-heading"
          className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground"
        >
          <History className="h-[15px] w-[15px]" aria-hidden />
          Correspondence
        </h2>

        {detail.correspondence.length === 0 ? (
          <div className="rounded-xl border border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
            No email correspondence yet. Synced threads for this client appear here
            automatically.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Direction</TableHead>
                  <TableHead>Counterparties</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Evidence</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.correspondence.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        {row.direction === "OUTBOUND" ? (
                          <ArrowUpRight className="h-3.5 w-3.5 text-[#5F5E5A]" aria-hidden />
                        ) : (
                          <ArrowDownLeft className="h-3.5 w-3.5 text-[#5F5E5A]" aria-hidden />
                        )}
                        {directionLabel(row.direction)}
                        {row.viaHouseholdMember && row.memberClientName ? (
                          <Badge variant="outline" className="ml-1 font-normal">
                            via {row.memberClientName}
                          </Badge>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate font-mono text-xs">
                      {row.counterparties.join(", ") || "—"}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate">
                      <span className="inline-flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 shrink-0 text-[#5F5E5A]" aria-hidden />
                        {row.title ?? "(no subject)"}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {dateFmt.format(new Date(row.occurredAt))}
                    </TableCell>
                    <TableCell>
                      <span
                        className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground"
                        title={row.contentSha256 ?? undefined}
                      >
                        <Hash className="h-3 w-3" aria-hidden />
                        {shortHash(row.contentSha256)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {row.threadId ? (
                        <Link
                          href={`/communications/threads/${row.threadId}`}
                          className="text-sm font-semibold text-[#177a4c] hover:underline"
                        >
                          Open thread
                        </Link>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
