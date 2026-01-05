"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";

interface NavigationProps {
  userEmail?: string | null;
  userName?: string | null;
}

export function Navigation({ userEmail, userName }: NavigationProps) {
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname?.startsWith(path);
  };

  const navLinks = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/upload", label: "Upload" },
    { href: "/settings", label: "Settings" },
  ];

  return (
    <nav className="border-b">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo and Main Navigation */}
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-2">
              <img 
                src="/intellivault-logo.svg" 
                alt="Comply Vault" 
                className="h-8 w-auto"
              />
              <span className="text-xl font-bold">
                Comply Vault
              </span>
            </Link>
            <div className="hidden md:flex md:gap-1">
              {navLinks.map((link) => (
                <Button
                  key={link.href}
                  variant={isActive(link.href) ? "secondary" : "ghost"}
                  asChild
                >
                  <Link href={link.href}>{link.label}</Link>
                </Button>
              ))}
            </div>
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-4">
            <div className="hidden text-sm text-muted-foreground sm:block">
              {userName || userEmail || "User"}
            </div>
            <Button
              variant="ghost"
              onClick={() => signOut({ callbackUrl: "/" })}
            >
              Sign Out
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="border-t md:hidden">
          <div className="flex flex-col space-y-1 px-2 py-3">
            {navLinks.map((link) => (
              <Button
                key={link.href}
                variant={isActive(link.href) ? "secondary" : "ghost"}
                className="justify-start"
                asChild
              >
                <Link href={link.href}>{link.label}</Link>
              </Button>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}

