"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Settings2 } from "lucide-react";
import { cn } from "~/lib/utils";
import { DISCLOSURE_CONFIG_PATH, type Disclosure } from "./demo-data";

export function DisclosuresCollapse({ items }: { items: Disclosure[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-lg border bg-surface-card">
      <div className="flex items-center gap-2.5 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          className="flex flex-1 items-center gap-2.5 text-left text-[13px] hover:text-text-primary"
        >
          <Settings2 className="h-3.5 w-3.5 shrink-0 text-text-muted" />
          <span className="flex-1">
            {items.length} items configured as required
          </span>
        </button>
        <Link
          href={DISCLOSURE_CONFIG_PATH}
          onClick={(event) => event.stopPropagation()}
          className="text-xs text-brand hover:underline"
        >
          edit
        </Link>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-label={open ? "Collapse" : "Expand"}
        >
          <ChevronRight
            className={cn(
              "h-4 w-4 shrink-0 text-text-muted transition-transform",
              open && "rotate-90",
            )}
          />
        </button>
      </div>
      {open ? (
        <p className="border-t px-4 py-3 text-[13px] leading-relaxed text-text-secondary">
          {items.map((disclosure) => disclosure.item).join(", ")}
        </p>
      ) : null}
    </div>
  );
}
