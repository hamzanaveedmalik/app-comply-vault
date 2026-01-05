"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

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
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo and Main Navigation */}
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center">
              <span className="text-xl font-bold text-gray-900">
                RIA Compliance
              </span>
            </Link>
            <div className="hidden md:flex md:gap-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive(link.href)
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-4">
            <div className="hidden text-sm text-gray-600 sm:block">
              {userName || userEmail || "User"}
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="border-t border-gray-200 md:hidden">
          <div className="flex flex-col space-y-1 px-2 py-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-md px-3 py-2 text-sm font-medium ${
                  isActive(link.href)
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}

