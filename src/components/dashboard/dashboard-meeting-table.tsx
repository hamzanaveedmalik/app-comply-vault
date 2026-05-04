"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { MeetingRow } from "~/lib/dashboard-types";
import { DashboardStatusBadge } from "~/components/dashboard/dashboard-status-badge";
import { MeetingFlagsCell } from "~/components/dashboard/meeting-flags-cell";

type DashboardMeetingTableProps = {
  totalMeetings: number;
  pendingReview: number;
  initialRows: MeetingRow[];
};

export function DashboardMeetingTable({
  totalMeetings,
  pendingReview,
  initialRows,
}: DashboardMeetingTableProps): React.JSX.Element {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  useEffect(() => {
    const processing = rows.filter(
      (m) => m.rawStatus === "PROCESSING" || m.rawStatus === "UPLOADING",
    );
    if (processing.length === 0) return;

    const id = window.setInterval(async () => {
      for (const meeting of processing) {
        try {
          const res = await fetch(`/api/meetings/${meeting.id}/status`);
          if (!res.ok) continue;
          const data: { status: string } = await res.json();
          if (data.status !== meeting.rawStatus) {
            router.refresh();
            return;
          }
        } catch {
          /* ignore */
        }
      }
    }, 5000);

    return () => window.clearInterval(id);
  }, [rows, router]);

  const dateFmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <section className="rounded-[14px] border border-surface-border bg-surface-card shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-surface-divider px-5 py-4">
        <div>
          <h2 className="text-[15px] font-semibold text-text-primary">Meetings</h2>
          <p className="mt-0.5 text-[11px] text-text-muted">
            {totalMeetings} meetings · {pendingReview} require your review
          </p>
        </div>
        <Link
          href="/upload"
          className="inline-flex items-center rounded-lg bg-brand px-3 py-2 text-[12px] font-semibold text-white shadow-[0_2px_8px_rgba(17,122,75,0.15)] transition hover:bg-brand-mid"
        >
          + Upload Meeting
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] table-fixed border-collapse text-left">
          <thead>
            <tr className="border-b border-surface-divider">
              <th className="w-[25%] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-text-muted">
                Client
              </th>
              <th className="w-[22%] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-text-muted">
                Type
              </th>
              <th className="w-[12%] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-text-muted">
                Date
              </th>
              <th className="w-[10%] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-text-muted">
                Flags
              </th>
              <th className="w-[16%] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-text-muted">
                Status
              </th>
              <th className="w-[10%] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-text-muted">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const processing =
                row.rawStatus === "PROCESSING" || row.rawStatus === "UPLOADING";
              return (
                <tr
                  key={row.id}
                  className="cursor-pointer border-b border-surface-divider transition-colors duration-100 hover:bg-surface-hover"
                  tabIndex={0}
                  onClick={() => router.push(`/meetings/${row.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") router.push(`/meetings/${row.id}`);
                  }}
                >
                  <td className="px-5 py-3 text-[13px] font-semibold text-text-primary">
                    {row.clientName}
                  </td>
                  <td className="px-5 py-3 text-[12px] text-text-secondary">{row.meetingType}</td>
                  <td className="px-5 py-3 text-[12px] text-text-secondary">
                    {dateFmt.format(new Date(row.date))}
                  </td>
                  <td className="px-5 py-3">
                    <MeetingFlagsCell flagCount={row.flagCount} />
                  </td>
                  <td className="px-5 py-3">
                    <DashboardStatusBadge
                      status={row.status}
                      label={row.statusLabel}
                      processing={processing}
                    />
                  </td>
                  <td className="px-5 py-3">
                    <Link
                      href={`/meetings/${row.id}`}
                      className="text-[12px] font-semibold text-brand hover:text-brand-mid"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
