"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function PriorityInboxError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.JSX.Element {
  useEffect(() => {
    console.error("Priority Inbox error", error.digest ?? "no-digest");
  }, [error]);

  return (
    <div className="min-h-0 bg-surface-page px-6 py-6">
      <div className="mx-auto max-w-lg rounded-[12px] border border-[#e6e8e6] bg-white p-6">
        <h1 className="text-[16px] font-semibold text-[#141f19]">
          Priority Inbox could not be loaded
        </h1>
        <p className="mt-2 text-[13px] text-[#5f6b64]">
          An error occurred while loading escalated findings. Retry, or return to the
          Command Centre.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-[8px] bg-[#0D2818] px-3 py-2 text-[13px] font-medium text-white"
          >
            Retry
          </button>
          <Link
            href="/supervision"
            className="rounded-[8px] border border-[#e6e8e6] px-3 py-2 text-[13px] font-medium text-[#141f19]"
          >
            Command Centre
          </Link>
        </div>
      </div>
    </div>
  );
}
