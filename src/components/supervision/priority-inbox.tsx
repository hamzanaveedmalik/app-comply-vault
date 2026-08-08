import Link from "next/link";
import { ScrollToFinding } from "~/components/supervision/scroll-to-finding";
import type { PriorityInboxDto, PriorityInboxFindingDto } from "~/lib/types";
import type { SupervisionFilterState } from "~/server/supervision/filters";
import {
  PRIORITY_INBOX_TABS,
  SUPERVISION_FILTER_LABELS,
  supervisionHref,
} from "~/server/supervision/filters";

type PriorityInboxProps = {
  inbox: PriorityInboxDto;
  filters: SupervisionFilterState;
  focusId?: string;
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function severityLabel(severity: PriorityInboxFindingDto["severity"]): string {
  return SUPERVISION_FILTER_LABELS.severity[severity];
}

function materialityLabel(materiality: PriorityInboxFindingDto["materiality"]): string {
  switch (materiality) {
    case "HIGH":
      return "High";
    case "MEDIUM":
      return "Medium";
    case "LOW":
      return "Low";
  }
}

function statusLabel(status: PriorityInboxFindingDto["status"]): string {
  return SUPERVISION_FILTER_LABELS.findingStatus[status];
}

function controlLabel(control: string): string {
  const known = Object.keys(SUPERVISION_FILTER_LABELS.control).find(
    (key) => key === control,
  );
  return known
    ? SUPERVISION_FILTER_LABELS.control[
        known as keyof typeof SUPERVISION_FILTER_LABELS.control // CAST: key narrowed from control label map
      ]
    : control;
}

function channelLabel(channels: PriorityInboxFindingDto["channels"]): string {
  return channels
    .map((channel) => SUPERVISION_FILTER_LABELS.channel[channel])
    .join(" + ");
}

function confidenceLabel(confidence: number | null): string {
  if (confidence === null) return "—";
  return `${Math.round(confidence * 100)}%`;
}

export function PriorityInbox({
  inbox,
  filters,
  focusId,
}: PriorityInboxProps): React.JSX.Element {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      {focusId ? <ScrollToFinding findingId={focusId} /> : null}
      <div>
        <Link
          href={supervisionHref("/supervision", { ...filters, inboxTab: undefined })}
          className="text-[12.5px] font-medium text-[#177a4c] hover:underline"
        >
          ← Command Centre
        </Link>
      </div>

      <header className="space-y-2">
        <h1 className="text-[22px] font-semibold tracking-tight text-[#141f19]">
          CCO Priority Inbox
        </h1>
        <p className="max-w-3xl text-[14px] leading-snug text-[#5f6b64]">
          Escalated findings requiring human judgment. ComplyVault has not determined
          that a violation occurred.
        </p>
        <p className="text-[16px] font-semibold text-[#141f19]">
          {inbox.header.selectivityStatement}
        </p>
        <p className="text-[12.5px] text-[#79837d]">
          {inbox.header.priorityFindings} priority findings · {inbox.header.totalProcessed}{" "}
          processed interactions
        </p>
      </header>

      <nav aria-label="Priority Inbox tabs" className="flex flex-wrap gap-2">
        {PRIORITY_INBOX_TABS.map((tab) => {
          const active = inbox.tab === tab;
          return (
            <Link
              key={tab}
              href={supervisionHref("/priority-inbox", { ...filters, inboxTab: tab })}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "rounded-[8px] bg-[#0D2818] px-3 py-1.5 text-[13px] font-medium text-white"
                  : "rounded-[8px] border border-[#e6e8e6] bg-white px-3 py-1.5 text-[13px] font-medium text-[#141f19] hover:border-[#cfe3d8]"
              }
            >
              {SUPERVISION_FILTER_LABELS.inboxTab[tab]} ({inbox.tabCounts[tab]})
            </Link>
          );
        })}
      </nav>

      {inbox.findings.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-[#d7dbd7] bg-white px-4 py-10 text-center">
          <p className="text-[14px] font-medium text-[#141f19]">
            No findings require review in this tab
          </p>
          <p className="mt-1 text-[13px] text-[#5f6b64]">
            Cleared and routine sample interactions stay out of the Priority Inbox until a
            reviewer manually escalates them.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[#eef0ee] overflow-hidden rounded-[12px] border border-[#e6e8e6] bg-white">
          {inbox.findings.map((finding) => (
            <li
              key={finding.id}
              id={`finding-${finding.id}`}
              className={focusId === finding.id ? "bg-[#f3faf6]" : undefined}
            >
              <Link
                href={finding.href}
                className="block px-4 py-3 hover:bg-[#fafbfa] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#177a4c]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-[#141f19]">{finding.title}</p>
                    <p className="mt-1 text-[12.5px] leading-snug text-[#5f6b64]">
                      {finding.escalationReason}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.04em] text-[#79837d]">
                    <span>{severityLabel(finding.severity)}</span>
                    <span>{materialityLabel(finding.materiality)}</span>
                    <span>{statusLabel(finding.status)}</span>
                    {finding.repeatAdviser ? <span>Repeat adviser</span> : null}
                  </div>
                </div>
                <dl className="mt-3 grid gap-2 text-[12.5px] text-[#5f6b64] sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.04em] text-[#79837d]">Firm</dt>
                    <dd>{finding.firmName}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.04em] text-[#79837d]">Adviser</dt>
                    <dd>{finding.adviserName ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.04em] text-[#79837d]">
                      Client or household
                    </dt>
                    <dd>{finding.clientName ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.04em] text-[#79837d]">Channels</dt>
                    <dd>{channelLabel(finding.channels)}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.04em] text-[#79837d]">
                      Primary control
                    </dt>
                    <dd>{controlLabel(finding.primaryControl)}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.04em] text-[#79837d]">Owner</dt>
                    <dd>{finding.ownerName ?? "Unassigned"}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.04em] text-[#79837d]">Due</dt>
                    <dd>{formatDate(finding.dueAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.04em] text-[#79837d]">
                      Confidence · evidence
                    </dt>
                    <dd>
                      {confidenceLabel(finding.confidence)} · {finding.evidenceCount}
                    </dd>
                  </div>
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

