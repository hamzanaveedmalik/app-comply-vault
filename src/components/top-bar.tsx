"use client";

import { GlobalSearch } from "~/components/global-search";
import { UserMenu } from "~/components/user-menu";

interface TopBarProps {
  userEmail?: string | null;
  userName?: string | null;
  userImage?: string | null;
  userRole?: string | null;
  billingStatus?: string | null;
}

export function TopBar({
  userEmail,
  userName,
  userImage,
  userRole,
  billingStatus,
}: TopBarProps) {
  return (
    <div className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center gap-4 px-4 sm:px-6 lg:px-8">
        {/* Mobile: Add left padding for menu button */}
        <div className="lg:pl-0 pl-14 flex-1 max-w-2xl mx-auto">
          <GlobalSearch />
        </div>
        {/* User Menu - Top Right */}
        <div className="flex-shrink-0">
          <UserMenu
            userEmail={userEmail}
            userName={userName}
            userImage={userImage}
            userRole={userRole}
            billingStatus={billingStatus}
          />
        </div>
      </div>
    </div>
  );
}

