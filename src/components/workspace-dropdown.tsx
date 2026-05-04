"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Plus, Settings, Users } from "lucide-react";
import { toast } from "sonner";
import { useClickOutside } from "~/hooks/use-click-outside";
import type { TeamMemberDto, WorkspaceListItemDto } from "~/lib/workspace-types";
import { cn } from "~/lib/utils";

type WorkspaceDropdownProps = {
  activeWorkspaceId: string;
  /** Initial list from server; may be refreshed after switch */
  workspaces: WorkspaceListItemDto[];
  /** Active workspace client count (distinct clients in meetings) */
  clientCount: number;
};

export function WorkspaceDropdown({
  activeWorkspaceId,
  workspaces: initialWorkspaces,
  clientCount,
}: WorkspaceDropdownProps): React.JSX.Element {
  const router = useRouter();
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState(initialWorkspaces);
  const [team, setTeam] = useState<TeamMemberDto[] | null>(null);
  const [teamLoading, setTeamLoading] = useState(false);

  useEffect(() => {
    setWorkspaces(initialWorkspaces);
  }, [initialWorkspaces]);

  const active =
    workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0] ?? null;

  const loadTeam = useCallback(async (workspaceId: string) => {
    setTeamLoading(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/team`);
      if (!res.ok) {
        setTeam([]);
        return;
      }
      const data = (await res.json()) as TeamMemberDto[];
      setTeam(data);
    } catch {
      setTeam([]);
    } finally {
      setTeamLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    void loadTeam(activeWorkspaceId);
  }, [open, activeWorkspaceId, loadTeam]);

  useClickOutside(containerRef, () => setOpen(false), open);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  async function onSelectWorkspace(id: string): Promise<void> {
    if (id === activeWorkspaceId) {
      setOpen(false);
      return;
    }
    try {
      const res = await fetch("/api/workspaces/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: id }),
      });
      if (!res.ok) {
        toast.error("Could not switch workspace");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Could not switch workspace");
    }
  }

  const onlineCount = team?.filter((m) => m.status === "online").length ?? 0;

  const triggerName = active?.name ?? "Workspace";
  const triggerInitials = active?.initials ?? "WS";

  return (
    <div ref={containerRef} className="relative mx-3 mt-3 mb-1">
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-2 rounded-lg border px-[10px] py-[9px] text-left transition-all duration-150",
          open
            ? "border-sidebar-open-border bg-sidebar-border"
            : "border-sidebar-active-border bg-sidebar-surface",
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listboxId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <div
          className={cn(
            "flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[6px] text-[10px] font-bold leading-none text-sidebar-muted",
            open ? "bg-black/25" : "bg-sidebar-border",
          )}
        >
          {triggerInitials.slice(0, 2)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-semibold leading-tight text-sidebar-text-bright">
            {triggerName}
          </div>
          <div className="mt-0.5 text-[10px] font-normal leading-tight text-sidebar-muted">
            {clientCount === 1 ? "1 RIA client" : `${clientCount} RIA clients`}
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-[14px] w-[14px] shrink-0 text-sidebar-muted transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          id={listboxId}
          className="workspace-dropdown-panel absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-[10px] border border-sidebar-active-border bg-sidebar-surface shadow-[0_12px_36px_rgba(0,0,0,0.4)]"
          role="presentation"
        >
          <div className="px-2.5 pb-1.5 pt-2.5">
            <div
              className="px-1 pb-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-sidebar-muted"
              id={`${listboxId}-ws-label`}
            >
              Workspaces
            </div>
            <div
              className="flex flex-col gap-2"
              role="listbox"
              aria-labelledby={`${listboxId}-ws-label`}
            >
              {workspaces.map((ws) => {
                const isCurrent = ws.id === activeWorkspaceId;
                return (
                  <button
                    key={ws.id}
                    type="button"
                    role="option"
                    aria-selected={isCurrent}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-[6px] px-2 py-[7px] text-left transition-[background] duration-100",
                      isCurrent
                        ? "bg-[rgba(17,122,75,0.2)]"
                        : "bg-transparent hover:bg-[rgba(255,255,255,0.05)]",
                    )}
                    onClick={() => void onSelectWorkspace(ws.id)}
                  >
                    <div
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px] text-[9px] font-bold leading-none",
                        isCurrent
                          ? "bg-brand text-white"
                          : "bg-black/25 text-sidebar-muted",
                      )}
                    >
                      {ws.initials.slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div
                        className={cn(
                          "text-[11.5px] leading-tight",
                          isCurrent
                            ? "font-semibold text-sidebar-text-bright"
                            : "font-normal text-sidebar-text",
                        )}
                      >
                        {ws.name}
                      </div>
                      <div
                        className={cn(
                          "text-[9.5px] leading-tight",
                          isCurrent ? "text-sidebar-text-light" : "text-sidebar-muted",
                        )}
                      >
                        {ws.clientCount === 1
                          ? `1 client · ${ws.roleLabel}`
                          : `${ws.clientCount} clients · ${ws.roleLabel}`}
                      </div>
                    </div>
                    {isCurrent ? (
                      <Check className="h-[14px] w-[14px] shrink-0 text-sidebar-open-border" strokeWidth={2.5} aria-hidden />
                    ) : (
                      <span className="w-[14px] shrink-0" aria-hidden />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mx-2.5 my-0.5 h-px shrink-0 bg-sidebar-hairline" aria-hidden />

          <div className="px-2.5 pb-2 pt-1">
            <div className="flex items-center justify-between px-1 pb-1.5">
              <div className="flex items-center gap-1.5">
                <Users className="h-[15px] w-[15px] text-sidebar-muted" aria-hidden />
                <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-sidebar-muted">
                  Team
                </span>
              </div>
              <span className="text-[9px] text-sidebar-muted">
                {teamLoading ? "…" : `${onlineCount} online`}
              </span>
            </div>
            <ul className="flex flex-col gap-0.5" role="list">
              {teamLoading ? (
                <li className="px-2 py-2 text-[10px] text-sidebar-muted">Loading team…</li>
              ) : (
                (team ?? []).map((member) => (
                  <li
                    key={member.id}
                    className="flex cursor-default items-center gap-2 rounded-md px-2 py-1.5"
                    role="listitem"
                  >
                    <div className="relative shrink-0">
                      <div
                        className="flex h-[26px] w-[26px] items-center justify-center rounded-full text-[9px] font-bold text-white"
                        style={{
                          background: `linear-gradient(135deg, ${member.avatarColor}, ${member.avatarColor}88)`,
                        }}
                      >
                        {member.initials}
                      </div>
                      <span
                        className="absolute -bottom-px -right-px h-[9px] w-[9px] rounded-full border-2 border-sidebar-surface"
                        style={{
                          backgroundColor:
                            member.status === "online"
                              ? "var(--color-status-online)"
                              : member.status === "away"
                                ? "var(--color-status-away)"
                                : "var(--color-status-offline)",
                        }}
                        aria-label={member.status}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11.5px] font-medium text-sidebar-text-bright">
                        {member.name}
                      </div>
                      <div className="text-[9.5px] text-sidebar-muted">{member.role}</div>
                    </div>
                    <span className="text-right text-[9px] capitalize text-sidebar-muted">{member.status}</span>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="mx-2.5 my-0.5 h-px shrink-0 bg-sidebar-hairline" aria-hidden />

          <div className="flex flex-col px-2.5 py-1.5">
            <button
              type="button"
              className="flex w-full items-center gap-1.5 rounded-md border-0 bg-transparent px-2 py-[7px] text-left text-[11px] font-medium text-sidebar-text transition-[background] duration-100 hover:bg-[rgba(255,255,255,0.05)]"
              onClick={() => toast.info("Invite team member will be available in a future update.")}
            >
              <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
              Invite team member
            </button>
            <Link
              href="/settings/workspace"
              className="flex w-full items-center gap-1.5 rounded-md px-2 py-[7px] text-[11px] font-medium text-sidebar-text transition-[background] duration-100 hover:bg-[rgba(255,255,255,0.05)]"
              onClick={() => setOpen(false)}
            >
              <Settings className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
              Workspace settings
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
