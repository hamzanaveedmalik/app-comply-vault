"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "~/lib/utils";

export function NotificationBellButton(): React.JSX.Element {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const res = await fetch("/api/notifications/count");
        if (!res.ok) return;
        const data: { count: number } = await res.json();
        if (!cancelled) setCount(data.count ?? 0);
      } catch {
        /* ignore */
      }
    }
    void load();
    const t = window.setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, []);

  return (
    <Link
      href="/notifications"
      className="relative flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary transition hover:bg-surface-hover hover:text-text-primary"
      aria-label={count > 0 ? `Notifications, ${count} unread` : "Notifications"}
    >
      <Bell className="h-5 w-5" aria-hidden />
      {count > 0 ? (
        <span
          className={cn(
            "absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-semantic-danger px-1 text-[10px] font-semibold text-white ring-2 ring-white",
          )}
        >
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </Link>
  );
}
