"use client";

import { useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import {
  RIACT_DEMO_USER,
  RIACT_DEMO_ROUTE,
  riactPrimaryWorkspaceId,
} from "~/server/demo/riact/tenant";

export function RiactDemoLoginClient(): React.JSX.Element {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startDemo = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const result = await signIn("credentials", {
        email: RIACT_DEMO_USER.email,
        password: RIACT_DEMO_USER.password,
        redirect: false,
      });
      if (!result?.ok || result.error) {
        setError(
          "Demo login failed. Run npx tsx scripts/seed-riact.ts --confirm against this DATABASE_URL, then retry.",
        );
        return;
      }

      const session = await getSession();
      if (!session?.user?.id) {
        setError(
          "Sign-in did not establish a session. Check DATABASE_URL in .env.local matches the seeded database.",
        );
        return;
      }

      const switchRes = await fetch("/api/workspaces/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: riactPrimaryWorkspaceId() }),
      });
      if (!switchRes.ok) {
        const body = (await switchRes.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(
          body?.error ??
            "Signed in but could not activate the Cactus Wren workspace. Confirm seed ran on the same database as the dev server.",
        );
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Unexpected error starting the demo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Sonoran Compliance Partners</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Prepared RIACT partner demo — Cactus Wren Advisory evidence corpus with
          honest coverage gaps. No live production data.
        </p>
        <dl className="mt-4 grid gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Demo user</dt>
            <dd className="font-mono text-xs">{RIACT_DEMO_USER.email}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Primary firm</dt>
            <dd>Cactus Wren Advisory</dd>
          </div>
        </dl>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Button className="w-full" disabled={loading} onClick={() => void startDemo()}>
        {loading ? "Starting demo…" : "Start demo as Owner / CCO"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Route: {RIACT_DEMO_ROUTE}
      </p>
    </div>
  );
}
