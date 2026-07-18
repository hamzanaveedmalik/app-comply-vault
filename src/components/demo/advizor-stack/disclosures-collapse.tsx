"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "~/lib/utils";
import type { Disclosure } from "./demo-data";

export function DisclosuresCollapse({ items }: { items: Disclosure[] }) {
  const [open, setOpen] = useState(false);
  const preview = items
    .slice(0, 3)
    .map((d) => d.item.split(" ")[0]?.toLowerCase())
    .join(", ");
  const remaining = items.length - 3;

  return (
    <div className="overflow-hidden rounded-lg border bg-surface-card">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-[13px] hover:bg-surface-hover"
      >
        <span className="text-text-secondary">
          {preview}
          {remaining > 0 ? ` and ${remaining} more` : ""}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-text-muted transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open ? (
        <ul className="border-t">
          {items.map((disclosure) => (
            <li
              key={disclosure.item}
              className="flex items-center gap-2.5 border-b px-4 py-2.5 text-[13px] last:border-b-0"
            >
              <span className="flex-1">{disclosure.item}</span>
              <span className="text-[11px] text-text-muted">
                {disclosure.reference}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
