"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
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
  ChevronDown,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { useState } from "react";

export type AppSidebarProps = {
  userEmail?: string | null;
  userName?: string | null;
  userRole?: string | null;
  workspaceName?: string | null;
  workspaceMemberCount?: number;
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

export function AppSidebar({
  userEmail,
  userName,
  userRole,
  workspaceName,
  workspaceMemberCount = 0,
  reviewQueueCount = 0,
}: AppSidebarProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === "/dashboard") return pathname === "/dashboard";
    return pathname?.startsWith(path);
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

  const displayWorkspace = workspaceName ?? "Workspace";
  const workspaceInitials = initials(displayWorkspace, null);

  const SidebarContent = () => (
    <div className="flex h-full flex-col bg-sidebar-bg font-sans">
      <div className="border-b border-sidebar-border px-4 py-4">
        <Link
          href="/dashboard"
          className="flex items-start gap-3"
          onClick={() => setIsOpen(false)}
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

      <div className="px-3 py-3">
        <button
          type="button"
          className="flex w-full cursor-default items-center gap-2.5 rounded-lg border border-sidebar-active-border bg-sidebar-surface px-2.5 py-2 text-left"
          aria-haspopup="listbox"
          aria-expanded={false}
        >
          <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-mid text-[10px] font-semibold text-white">
            {workspaceInitials.slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium text-sidebar-text-light">
              {displayWorkspace}
            </div>
            <div className="text-[11px] text-sidebar-muted">
              {workspaceMemberCount} member{workspaceMemberCount !== 1 ? "s" : ""}
            </div>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-sidebar-muted" aria-hidden />
        </button>
      </div>

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
              <Link href={item.href} onClick={() => setIsOpen(false)}>
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

      <div className="mt-auto border-t border-sidebar-border p-3">
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
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[244px] flex-col border-r border-sidebar-border lg:flex">
        <SidebarContent />
      </aside>

      <div className="fixed left-0 top-0 z-50 lg:hidden">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-14 w-14 rounded-none text-text-primary">
              <Menu className="h-6 w-6" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[244px] border-sidebar-border bg-sidebar-bg p-0">
            <SidebarContent />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
