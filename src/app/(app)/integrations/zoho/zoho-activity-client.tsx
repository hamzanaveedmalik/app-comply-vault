"use client";

import type { ReactElement, ReactNode } from "react";
import { useCallback, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, ListTodo, CalendarDays, Inbox } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import type { ZohoMeetingDto, ZohoTaskDto } from "~/server/integrations/zoho/crm-api";
import type { ZohoActivityScope } from "~/server/integrations/zoho/list-activities";

type Props = {
  tasks: ZohoTaskDto[];
  meetings: ZohoMeetingDto[];
  scope: ZohoActivityScope;
  fetchedAtIso: string;
  filterEmail: string | null;
  currentUserEmail: string | null;
};

const DATE_FMT = new Intl.DateTimeFormat(undefined, {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const DATE_TIME_FMT = new Intl.DateTimeFormat(undefined, {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const TIME_FMT = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
});

function formatDateOnly(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return DATE_FMT.format(d);
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return DATE_TIME_FMT.format(d);
}

function priorityVariant(priority: string | null): "default" | "secondary" | "destructive" | "outline" {
  switch ((priority ?? "").toLowerCase()) {
    case "high":
    case "highest":
      return "destructive";
    case "low":
    case "lowest":
      return "outline";
    case "normal":
    case "medium":
      return "secondary";
    default:
      return "outline";
  }
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status.toLowerCase()) {
    case "in progress":
      return "default";
    case "deferred":
    case "waiting for input":
      return "secondary";
    case "not started":
      return "outline";
    default:
      return "outline";
  }
}

export function ZohoActivityClient({
  tasks,
  meetings,
  scope,
  fetchedAtIso,
  filterEmail,
  currentUserEmail,
}: Props): ReactElement {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const setScope = useCallback(
    (next: ZohoActivityScope) => {
      if (next === scope) return;
      const qs = next === "all" ? "?scope=all" : "";
      startTransition(() => {
        router.push(`/integrations/zoho${qs}`);
      });
    },
    [router, scope]
  );

  const handleRefresh = useCallback(() => {
    startTransition(() => {
      router.refresh();
    });
  }, [router]);

  const fetchedAtLabel = useMemo(() => {
    const d = new Date(fetchedAtIso);
    if (Number.isNaN(d.getTime())) return "";
    return TIME_FMT.format(d);
  }, [fetchedAtIso]);

  const showingMineWithoutEmail =
    scope === "mine" && filterEmail === null && currentUserEmail === null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center rounded-lg border bg-muted p-[3px]">
          <button
            type="button"
            onClick={() => setScope("mine")}
            disabled={pending}
            className={cn(
              "inline-flex h-7 items-center rounded-md px-3 text-sm font-medium transition-colors",
              scope === "mine"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            My items
          </button>
          <button
            type="button"
            onClick={() => setScope("all")}
            disabled={pending}
            className={cn(
              "inline-flex h-7 items-center rounded-md px-3 text-sm font-medium transition-colors",
              scope === "all"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            All workspace
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Updated {fetchedAtLabel}
            {filterEmail ? ` · Filter: ${filterEmail}` : ""}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={pending}
          >
            <RefreshCw className={cn("size-4", pending && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {showingMineWithoutEmail && (
        <p className="text-xs text-muted-foreground">
          We could not determine your email, so we cannot filter to your Zoho
          owner. Switch to <strong>All workspace</strong> to see everything.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListTodo className="size-4" />
              Open Tasks
              <Badge variant="secondary" className="ml-2">
                {tasks.length}
              </Badge>
            </CardTitle>
            <CardDescription>
              Tasks in Zoho CRM where status is not Completed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <EmptyState
                icon={<Inbox className="size-6 text-muted-foreground" />}
                message="No open tasks."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead className="w-[120px]">Due</TableHead>
                    <TableHead className="w-[120px]">Status</TableHead>
                    <TableHead className="w-[100px]">Priority</TableHead>
                    {scope === "all" && <TableHead>Owner</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.subject}</TableCell>
                      <TableCell>{formatDateOnly(t.dueDate)}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(t.status)}>{t.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {t.priority ? (
                          <Badge variant={priorityVariant(t.priority)}>
                            {t.priority}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      {scope === "all" && (
                        <TableCell className="text-muted-foreground">
                          {t.ownerName ?? t.ownerEmail ?? "—"}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="size-4" />
              Upcoming Meetings
              <Badge variant="secondary" className="ml-2">
                {meetings.length}
              </Badge>
            </CardTitle>
            <CardDescription>
              Scheduled Zoho CRM events starting now or in the future.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {meetings.length === 0 ? (
              <EmptyState
                icon={<Inbox className="size-6 text-muted-foreground" />}
                message="No upcoming meetings."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead className="w-[180px]">Start</TableHead>
                    <TableHead className="w-[180px]">End</TableHead>
                    {scope === "all" && <TableHead>Owner</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {meetings.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.title}</TableCell>
                      <TableCell>{formatDateTime(m.startIso)}</TableCell>
                      <TableCell>{formatDateTime(m.endIso)}</TableCell>
                      {scope === "all" && (
                        <TableCell className="text-muted-foreground">
                          {m.ownerName ?? m.ownerEmail ?? "—"}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmptyState({
  icon,
  message,
}: {
  icon: ReactNode;
  message: string;
}): ReactElement {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
      {icon}
      <p>{message}</p>
    </div>
  );
}
