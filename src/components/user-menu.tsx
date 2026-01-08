"use client";

import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { Settings, Bell, LogOut, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { useNotifications } from "~/hooks/use-notifications";

interface UserMenuProps {
  userEmail?: string | null;
  userName?: string | null;
  userImage?: string | null;
  userRole?: string | null;
}

export function UserMenu({ userEmail, userName, userImage, userRole }: UserMenuProps) {
  const router = useRouter();
  const { notificationCount } = useNotifications();

  const getInitials = () => {
    if (userName) {
      return userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (userEmail) {
      return userEmail[0]?.toUpperCase() ?? "U";
    }
    return "U";
  };

  return (
    <div className="flex items-center gap-2">
      {/* Settings Button */}
      <Button variant="ghost" size="icon" asChild>
        <Link href="/settings">
          <Settings className="h-5 w-5" />
          <span className="sr-only">Settings</span>
        </Link>
      </Button>

      {/* Notifications Button */}
      <Button variant="ghost" size="icon" asChild className="relative">
        <Link href="/notifications" className="relative">
          <Bell className="h-5 w-5" />
          {notificationCount > 0 && (
            <>
              {/* Red circle indicator for unread notifications */}
              <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-background animate-pulse" />
              {/* Counter badge */}
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs font-semibold shadow-lg z-10"
              >
                {notificationCount > 9 ? "9+" : notificationCount}
              </Badge>
            </>
          )}
          <span className="sr-only">Notifications</span>
        </Link>
      </Button>

      {/* User Avatar Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-9 w-9 rounded-full">
            <Avatar className="h-9 w-9">
              <AvatarImage src={userImage ?? undefined} alt={userName ?? userEmail ?? "User"} />
              <AvatarFallback>{getInitials()}</AvatarFallback>
            </Avatar>
            {notificationCount > 0 && (
              <>
                {/* Red circle indicator for unread notifications */}
                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-background animate-pulse" />
                {/* Counter badge */}
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs font-semibold border-2 border-background shadow-lg z-10"
                >
                  {notificationCount > 9 ? "9+" : notificationCount}
                </Badge>
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{userName || "User"}</p>
              <p className="text-xs leading-none text-muted-foreground">{userEmail}</p>
              {userRole && (
                <Badge variant="outline" className="mt-1 w-fit text-xs">
                  {userRole === "OWNER_CCO" ? "Owner/CCO" : "Member"}
                </Badge>
              )}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/notifications" className="flex items-center">
              <Bell className="mr-2 h-4 w-4" />
              Notifications
              {notificationCount > 0 && (
                <Badge variant="destructive" className="ml-auto">
                  {notificationCount > 9 ? "9+" : notificationCount}
                </Badge>
              )}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings" className="flex items-center">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => signOut({ callbackUrl: "/" })}
            className="text-red-600 focus:text-red-600"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

