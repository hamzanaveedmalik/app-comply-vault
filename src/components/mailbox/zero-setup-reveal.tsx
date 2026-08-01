"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { isRelease1DemoEnabled } from "~/lib/feature-flags";

/**
 * CV-OB / N2 — Zero setup to first evidence.
 * After connect, land on exposure — not a client roster.
 */
export function ZeroSetupReveal({
  heldIdentityCount = 0,
  openFlagCount = 0,
  parkedCount = 0,
}: {
  heldIdentityCount?: number;
  openFlagCount?: number;
  parkedCount?: number;
}): React.JSX.Element | null {
  if (!isRelease1DemoEnabled()) return null;

  return (
    <section
      className="rounded-lg border border-brand/25 bg-brand/5 p-5"
      aria-labelledby="zero-setup-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge variant="outline" className="border-brand/40 text-brand">
            Zero setup
          </Badge>
          <h2
            id="zero-setup-heading"
            className="mt-2 text-lg font-semibold tracking-tight text-[#0D2818]"
          >
            First evidence — no client records typed
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Connect the mailbox and supervision evidence appears. Ambiguous
            identities are held for confirmation rather than silently assigned —
            that is the product working, not unfinished setup.
          </p>
        </div>
        <Button asChild className="bg-[#0D2818] hover:bg-[#0D2818]/90">
          <Link href="/needs-attention">
            What the mailbox disclosed
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
      <ul className="mt-4 flex flex-wrap gap-3 text-sm">
        <li className="rounded-md border bg-background px-3 py-1.5">
          <span className="font-medium text-foreground">{heldIdentityCount}</span>{" "}
          <span className="text-muted-foreground">held for confirmation</span>
        </li>
        <li className="rounded-md border bg-background px-3 py-1.5">
          <span className="font-medium text-foreground">{openFlagCount}</span>{" "}
          <span className="text-muted-foreground">open triage signals</span>
        </li>
        <li className="rounded-md border bg-background px-3 py-1.5">
          <span className="font-medium text-foreground">{parkedCount}</span>{" "}
          <span className="text-muted-foreground">fail-closed parked</span>
        </li>
      </ul>
    </section>
  );
}
