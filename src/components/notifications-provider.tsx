"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "~/lib/toast";

type NotificationsContextValue = {
  notificationCount: number;
};

const NotificationsContext = createContext<NotificationsContextValue>({
  notificationCount: 0,
});

export function NotificationsProvider({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  const router = useRouter();
  const [notificationCount, setNotificationCount] = useState(0);
  const previousCountRef = useRef(0);
  const isInitialMount = useRef(true);

  useEffect(() => {
    const fetchNotifications = async (): Promise<void> => {
      try {
        const response = await fetch("/api/notifications/count", {
          credentials: "include",
        });
        if (!response.ok) return;

        const data: { count?: number } = await response.json();
        const newCount = data.count ?? 0;
        const previousCount = previousCountRef.current;

        if (
          !isInitialMount.current &&
          newCount > previousCount &&
          previousCount >= 0
        ) {
          const diff = newCount - previousCount;
          toast.info("New Notifications", {
            description: `You have ${diff} new notification${diff > 1 ? "s" : ""}`,
            action: {
              label: "View",
              onClick: () => {
                router.push("/notifications");
              },
            },
          });
        }

        setNotificationCount(newCount);
        previousCountRef.current = newCount;
        isInitialMount.current = false;
      } catch (error) {
        console.error("Error fetching notifications:", error);
      }
    };

    void fetchNotifications();
    const interval = window.setInterval(() => void fetchNotifications(), 30_000);
    return () => window.clearInterval(interval);
  }, [router]);

  return (
    <NotificationsContext.Provider value={{ notificationCount }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextValue {
  return useContext(NotificationsContext);
}
