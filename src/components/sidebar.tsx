"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Button } from "~/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "~/components/ui/sheet";
import { Menu } from "lucide-react";
import { cn } from "~/lib/utils";
import { useState } from "react";

interface SidebarProps {
  userEmail?: string | null;
  userName?: string | null;
  userRole?: string | null;
}

export function Sidebar({ userEmail, userName, userRole }: SidebarProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname?.startsWith(path);
  };

  const navLinks = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/interaction-log", label: "Interaction Log" },
    { href: "/review", label: "Review Queue" },
    { href: "/upload", label: "Upload" },
    ...(userRole === "OWNER_CCO" ? [{ href: "/audit-logs", label: "Audit Logs" }] : []),
  ];

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/dashboard" className="flex items-center gap-3" onClick={() => setIsOpen(false)}>
          <img 
            src="/intellivault-logo.svg" 
            alt="Comply Vault" 
            className="h-16 w-auto"
          />
          <span className="text-xl font-bold">
            Comply Vault
          </span>
        </Link>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navLinks.map((link) => (
          <Button
            key={link.href}
            variant={isActive(link.href) ? "secondary" : "ghost"}
            className={cn(
              "w-full justify-start",
              isActive(link.href) && "bg-secondary"
            )}
            asChild
          >
            <Link href={link.href} onClick={() => setIsOpen(false)}>
              {link.label}
            </Link>
          </Button>
        ))}
      </nav>

      {/* User Info - Simplified (full menu in top bar) */}
      <div className="border-t p-4">
        <div className="text-sm text-muted-foreground">
          {userName || userEmail || "User"}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar - Always visible */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col border-r bg-background">
        <SidebarContent />
      </aside>

      {/* Mobile Menu Button - Positioned in top bar */}
      <div className="lg:hidden fixed top-0 left-0 z-50">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-14 w-14 rounded-none">
              <Menu className="h-6 w-6" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SidebarContent />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}

