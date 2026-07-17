"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { cn } from "~/lib/utils";
import { useNotifications } from "~/hooks/use-notifications";

export function NotificationBellButton(): React.JSX.Element {
  const { notificationCount } = useNotifications();

  return (
    <Link
      href="/notifications"
      className="relative flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary transition hover:bg-surface-hover hover:text-text-primary"
      aria-label={
        notificationCount > 0
          ? `Notifications, ${notificationCount} unread`
          : "Notifications"
      }
    >
      <Bell className="h-5 w-5" aria-hidden />
      {notificationCount > 0 ? (
        <span
          className={cn(
            "absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-semantic-danger px-1 text-[10px] font-semibold text-white ring-2 ring-white",
          )}
        >
          {notificationCount > 9 ? "9+" : notificationCount}
        </span>
      ) : null}
    </Link>
  );
}
