"use client";

import { toast } from "sonner";
import { Button } from "~/components/ui/button";

export function ConnectButton({ source }: { source: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() =>
        toast("Connecting is disabled in this demo", {
          description: `${source} would be linked through its own secure flow in the full product.`,
        })
      }
    >
      Connect
    </Button>
  );
}
