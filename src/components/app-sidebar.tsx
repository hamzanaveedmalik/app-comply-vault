"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "~/components/ui/sheet";
import {
  CheckSquare,
  FileText,
  LayoutGrid,
  Menu,
  Settings,
  Shield,
  Upload,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { WorkspaceDropdown } from "~/components/layout/workspace-dropdown";
import { fetchTeamMembers, workspaceDtoToWorkspace } from "~/lib/workspace-api";
import type { TeamMember, Workspace } from "~/lib/types";
import type { WorkspaceListItemDto } from "~/lib/workspace-types";

export type AppSidebarProps = {
  userEmail?: string | null;
  userName?: string | null;
  userRole?: string | null;
  activeWorkspaceId: string;
  workspaces: WorkspaceListItemDto[];
  reviewQueueCount?: number;
};

function initials(name: string | null | undefined, email: string | null | undefined): string {
  const n = (name ?? "").trim();
  if (n.length > 0) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  }
  const e = (email ?? "").trim();
  if (e.length > 0) return e.slice(0, 2).toUpperCase();
  return "CV";
}

type AppSidebarPanelProps = {
  userEmail?: string | null;
  userName?: string | null;
  userRole?: string | null;
  activeWorkspaceId: string;
  activeWorkspace: Workspace | null;
  workspaceList: Workspace[];
  workspaces: WorkspaceListItemDto[];
  teamMembers: TeamMember[];
  teamLoading: boolean;
  reviewQueueCount: number;
  pathname: string | null;
  onSelectWorkspace: (ws: Workspace) => void;
  onInvite: () => void;
  onSettings: () => void;
  onOpenChange: (open: boolean) => void;
  onNavigate: () => void;
};

function AppSidebarPanel({
  userEmail,
  userName,
  userRole,
  activeWorkspaceId,
  activeWorkspace,
  workspaceList,
  workspaces,
  teamMembers,
  teamLoading,
  reviewQueueCount,
  pathname,
  onSelectWorkspace,
  onInvite,
  onSettings,
  onOpenChange,
  onNavigate,
}: AppSidebarPanelProps): React.JSX.Element {
  const isActive = (path: string): boolean => {
    if (path === "/dashboard") return pathname === "/dashboard";
    return pathname?.startsWith(path) ?? false;
  };

  const navItems: {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
    { href: "/interaction-log", label: "Interaction Log", icon: FileText },
    {
      href: "/review",
      label: "Review Queue",
      icon: CheckSquare,
      badge: reviewQueueCount > 0 ? reviewQueueCount : undefined,
    },
    { href: "/upload", label: "Upload", icon: Upload },
    ...(userRole === "OWNER_CCO"
      ? [
          { href: "/integrations", label: "Integrations", icon: Settings },
          { href: "/audit-logs", label: "Audit Logs", icon: Shield },
        ]
      : []),
  ];

  return (
    <div className="flex h-full flex-col bg-sidebar-bg font-sans">
      <div className="px-4 py-4">
        <Link
          href="/dashboard"
          className="flex items-start gap-3"
          onClick={onNavigate}
        >
          <div
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] bg-gradient-to-br from-brand to-brand-mid text-[13px] font-bold text-white"
            aria-hidden
          >
            CV
          </div>
          <div className="min-w-0 pt-0.5">
            <div className="truncate text-[15px] font-bold tracking-[-0.02em] text-sidebar-text-bright">
              ComplyVault
            </div>
            <div className="text-[9.5px] font-medium uppercase tracking-[0.06em] text-sidebar-muted">
              Compliance Command
            </div>
          </div>
        </Link>
      </div>

      <div className="h-px w-full shrink-0 bg-sidebar-hairline" aria-hidden />

      {activeWorkspaceId && workspaces.length > 0 && activeWorkspace ? (
        <WorkspaceDropdown
          activeWorkspace={activeWorkspace}
          workspaces={workspaceList}
          teamMembers={teamMembers}
          teamLoading={teamLoading}
          onSelectWorkspace={onSelectWorkspace}
          onInvite={onInvite}
          onSettings={onSettings}
          onOpenChange={onOpenChange}
        />
      ) : (
        <div className="mx-3 mt-3 mb-1">
          <Link
            href="/workspaces/new"
            className="block rounded-lg border border-sidebar-active-border bg-sidebar-surface px-[10px] py-[9px] text-center text-[12px] font-semibold text-sidebar-text-light hover:bg-sidebar-border"
            onClick={onNavigate}
          >
            Create workspace
          </Link>
        </div>
      )}

      <nav className="flex-1 space-y-1 px-2 pb-4">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Button
              key={item.href}
              variant="ghost"
              className={cn(
                "h-10 w-full justify-start gap-3 px-3 font-normal shadow-none",
                active
                  ? "bg-brand text-white shadow-[0_2px_8px_rgba(17,122,75,0.15)] hover:bg-brand hover:text-white"
                  : "text-sidebar-text hover:bg-sidebar-surface hover:text-sidebar-text-light",
              )}
              asChild
            >
              <Link href={item.href} onClick={onNavigate}>
                <Icon className="h-[18px] w-[18px] shrink-0 opacity-90" />
                <span className="text-[13px] font-semibold">{item.label}</span>
                {item.badge !== undefined ? (
                  <span
                    className={cn(
                      "ml-auto min-w-[22px] rounded-full px-2 py-0.5 text-center text-[11px] font-semibold",
                      active ? "bg-white/20 text-white" : "bg-semantic-orange text-white",
                    )}
                  >
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                ) : null}
              </Link>
            </Button>
          );
        })}
      </nav>

      <div className="mt-auto">
        <div className="h-px w-full shrink-0 bg-sidebar-hairline" aria-hidden />
        <div className="p-3">
          <div className="flex items-center gap-3 rounded-lg px-1 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-[#2DD881] text-[11px] font-semibold text-white">
              {initials(userName, userEmail)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium text-sidebar-text-light">
                {userName || userEmail || "User"}
              </div>
              <div className="truncate text-[11px] text-sidebar-muted">
                {userRole === "OWNER_CCO" ? "Owner / CCO" : "Member"}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 shrink-0 text-[11px] text-sidebar-text hover:bg-sidebar-surface hover:text-sidebar-text-light"
              onClick={() => void signOut({ callbackUrl: "/auth/signin" })}
            >
              Sign out
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppSidebar({
  userEmail,
  userName,
  userRole,
  activeWorkspaceId,
  workspaces,
  reviewQueueCount = 0,
}: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);

  const workspaceList = useMemo(
    () => workspaces.map(workspaceDtoToWorkspace),
    [workspaces],
  );

  const activeWorkspace = useMemo(() => {
    const dto = workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0];
    return dto ? workspaceDtoToWorkspace(dto) : null;
  }, [workspaces, activeWorkspaceId]);

  const loadTeam = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!activeWorkspaceId) {
        return;
      }
      if (!opts?.silent) {
        setTeamLoading(true);
      }
      try {
        const data = await fetchTeamMembers(activeWorkspaceId);
        setTeamMembers(data);
      } catch {
        setTeamMembers([]);
      } finally {
        if (!opts?.silent) {
          setTeamLoading(false);
        }
      }
    },
    [activeWorkspaceId],
  );

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  useEffect(() => {
    const id = window.setInterval(() => void loadTeam({ silent: true }), 30_000);
    return () => window.clearInterval(id);
  }, [loadTeam]);

  const onSelectWorkspace = useCallback(
    async (ws: Workspace) => {
      if (ws.id === activeWorkspaceId) {
        return;
      }
      try {
        const res = await fetch("/api/workspaces/switch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId: ws.id }),
        });
        if (!res.ok) {
          toast.error("Could not switch workspace");
          return;
        }
        router.refresh();
      } catch {
        toast.error("Could not switch workspace");
      }
    },
    [activeWorkspaceId, router],
  );

  const onInvite = useCallback(() => {
    router.push(`/workspaces/${activeWorkspaceId}/invite`);
  }, [activeWorkspaceId, router]);

  const onSettings = useCallback(() => {
    router.push("/settings/workspace");
  }, [router]);

  const onDropdownOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        void loadTeam({ silent: true });
      }
    },
    [loadTeam],
  );

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  const panelProps: AppSidebarPanelProps = {
    userEmail,
    userName,
    userRole,
    activeWorkspaceId,
    activeWorkspace,
    workspaceList,
    workspaces,
    teamMembers,
    teamLoading,
    reviewQueueCount,
    pathname,
    onSelectWorkspace,
    onInvite,
    onSettings,
    onOpenChange: onDropdownOpenChange,
    onNavigate: closeMobileMenu,
  };

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[244px] flex-col border-r border-sidebar-edge lg:flex">
        <AppSidebarPanel {...panelProps} />
      </aside>

      <div className="fixed left-0 top-0 z-50 lg:hidden">
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-14 w-14 rounded-none text-text-primary">
              <Menu className="h-6 w-6" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[244px] border-sidebar-edge bg-sidebar-bg p-0">
            <AppSidebarPanel {...panelProps} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
