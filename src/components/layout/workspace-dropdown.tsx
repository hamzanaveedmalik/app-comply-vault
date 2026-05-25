"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Plus, Settings, Users } from "lucide-react";
import { useClickOutside } from "~/hooks/use-click-outside";
import type { TeamMember, Workspace } from "~/lib/types";
import { cn } from "~/lib/utils";
import { GradientInitialsAvatar } from "~/components/layout/avatar";
import { StatusDot } from "~/components/layout/status-dot";

export type WorkspaceDropdownProps = {
  activeWorkspace: Workspace;
  workspaces: Workspace[];
  teamMembers: TeamMember[];
  /** When true, team section shows a loading line. */
  teamLoading?: boolean;
  onSelectWorkspace: (ws: Workspace) => void;
  onInvite: () => void;
  onSettings: () => void;
  canInviteTeam?: boolean;
  /** Fires when the panel opens or closes (e.g. parent refetch team on open). */
  onOpenChange?: (open: boolean) => void;
};

export function WorkspaceDropdown({
  activeWorkspace,
  workspaces,
  teamMembers,
  teamLoading = false,
  onSelectWorkspace,
  onInvite,
  onSettings,
  canInviteTeam = false,
  onOpenChange,
}: WorkspaceDropdownProps): React.JSX.Element {
  const listboxId = useId();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const setOpen = (next: boolean): void => {
    setIsOpen(next);
    onOpenChange?.(next);
  };

  useClickOutside(dropdownRef, () => setOpen(false), isOpen);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen]);

  const onlineCount = teamMembers.filter((t) => t.status === "online").length;

  const triggerInitials = activeWorkspace.initials.slice(0, 2).toUpperCase();
  const clientLine =
    activeWorkspace.clientCount === 1
      ? "1 RIA client"
      : `${activeWorkspace.clientCount} RIA clients`;

  return (
    <div ref={dropdownRef} className="relative mx-3 mt-3 mb-1">
      <button
        type="button"
        className={cn(
          "flex w-full cursor-pointer items-center gap-2 rounded-lg border px-[10px] py-[9px] text-left font-sans transition-all duration-150",
          isOpen
            ? "border-sidebar-open-border bg-sidebar-border"
            : "border-sidebar-active-border bg-sidebar-surface",
        )}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={isOpen ? listboxId : undefined}
        onClick={() => setOpen(!isOpen)}
      >
        <div
          className={cn(
            "flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[6px] text-[10px] font-bold leading-none text-sidebar-muted",
            isOpen ? "bg-black/25" : "bg-sidebar-border",
          )}
        >
          {triggerInitials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-semibold leading-tight text-sidebar-text-light">
            {activeWorkspace.name}
          </div>
          <div className="mt-0.5 text-[10px] font-normal leading-tight text-sidebar-muted">{clientLine}</div>
        </div>
        <ChevronDown
          className={cn(
            "h-[14px] w-[14px] shrink-0 text-sidebar-muted transition-transform duration-200 [&>path]:stroke-[2]",
            isOpen && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {isOpen ? (
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
            <div className="flex flex-col gap-2" role="listbox" aria-labelledby={`${listboxId}-ws-label`}>
              {workspaces.map((ws) => {
                const isCurrent = ws.id === activeWorkspace.id;
                return (
                  <button
                    key={ws.id}
                    type="button"
                    role="option"
                    aria-selected={isCurrent}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-2 rounded-[6px] border-0 px-2 py-[7px] text-left font-sans transition-[background] duration-100",
                      isCurrent
                        ? "bg-[rgba(17,122,75,0.2)]"
                        : "bg-transparent hover:bg-[rgba(255,255,255,0.05)]",
                    )}
                    onClick={() => {
                      onSelectWorkspace(ws);
                      setOpen(false);
                    }}
                  >
                    <div
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px] text-[9px] font-bold leading-none",
                        isCurrent ? "bg-brand text-white" : "bg-sidebar-border text-sidebar-muted",
                      )}
                    >
                      {ws.initials.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div
                        className={cn(
                          "text-[11.5px] leading-tight",
                          isCurrent ? "font-semibold text-sidebar-text-bright" : "font-normal text-sidebar-text",
                        )}
                      >
                        {ws.name}
                      </div>
                      <div className="text-[9.5px] font-normal leading-tight text-sidebar-muted">
                        {ws.clientCount === 1
                          ? `1 client · ${ws.role}`
                          : `${ws.clientCount} clients · ${ws.role}`}
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

          <div className="mx-2.5 my-0.5 h-px shrink-0 bg-sidebar-active-border" aria-hidden />

          <div className="px-2.5 pb-2 pt-1">
            <div className="flex items-center justify-between px-1 pb-1.5">
              <div className="flex items-center gap-1.5">
                <Users className="h-[15px] w-[15px] text-sidebar-muted [&>path]:stroke-[2]" aria-hidden />
                <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-sidebar-muted">
                  Team
                </span>
              </div>
              <span className="text-[9px] font-normal text-sidebar-muted">
                {teamLoading ? "…" : `${onlineCount} online`}
              </span>
            </div>
            <ul className="flex flex-col gap-0.5" role="list">
              {teamLoading ? (
                <li className="cursor-default px-2 py-2 text-[10px] text-sidebar-muted">Loading team…</li>
              ) : (
                teamMembers.map((member) => (
                  <li
                    key={member.id}
                    className="flex cursor-default items-center gap-2 rounded-md px-2 py-1.5"
                    role="listitem"
                  >
                    <div className="relative shrink-0">
                      <GradientInitialsAvatar initials={member.initials} avatarColor={member.avatarColor} />
                      <StatusDot status={member.status} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11.5px] font-medium leading-tight text-sidebar-text-light">
                        {member.name}
                      </div>
                      <div className="text-[9.5px] font-normal text-sidebar-muted">{member.role}</div>
                    </div>
                    <span className="ml-auto text-right text-[9px] font-normal capitalize text-sidebar-muted">
                      {member.status}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="mx-2.5 my-0.5 h-px shrink-0 bg-sidebar-active-border" aria-hidden />

          <div className="px-2.5 py-1 pb-2">
            {canInviteTeam ? (
              <button
                type="button"
                className="flex w-full cursor-pointer items-center gap-1.5 rounded-[6px] border-0 bg-transparent px-2 py-[7px] text-left font-sans text-[11px] font-medium text-sidebar-text transition-[background] duration-100 hover:bg-[rgba(255,255,255,0.05)]"
                onClick={() => {
                  onInvite();
                  setOpen(false);
                }}
              >
                <Plus className="h-[14px] w-[14px] shrink-0" strokeWidth={2} aria-hidden />
                Invite team member
              </button>
            ) : null}
            <button
              type="button"
              className="flex w-full cursor-pointer items-center gap-1.5 rounded-[6px] border-0 bg-transparent px-2 py-[7px] text-left font-sans text-[11px] font-medium text-sidebar-text transition-[background] duration-100 hover:bg-[rgba(255,255,255,0.05)]"
              onClick={() => {
                onSettings();
                setOpen(false);
              }}
            >
              <Settings className="h-[14px] w-[14px] shrink-0" strokeWidth={2} aria-hidden />
              Workspace settings
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
