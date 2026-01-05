"use client";

import { GlobalSearch } from "~/components/global-search";

export function TopBar() {
  return (
    <div className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center gap-4 px-4 sm:px-6 lg:px-8">
        {/* Mobile: Add left padding for menu button */}
        <div className="lg:pl-0 pl-14 flex-1 max-w-2xl mx-auto">
          <GlobalSearch />
        </div>
      </div>
    </div>
  );
}

