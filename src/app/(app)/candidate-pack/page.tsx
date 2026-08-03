import { redirect } from "next/navigation";
import { isRelease1DemoEnabled } from "~/lib/feature-flags";
import { requireAppAccess } from "~/server/auth/guards";
import { CandidatePackClient } from "./candidate-pack-client";

export default async function CandidatePackPage(): Promise<React.JSX.Element> {
  if (!isRelease1DemoEnabled()) redirect("/dashboard");

  const access = await requireAppAccess();
  if (!access.ok) {
    if (access.status === 401) redirect("/auth/signin");
    return <div className="p-6 text-destructive">{access.error}</div>;
  }
  if (access.session.user.role !== "OWNER_CCO") redirect("/dashboard");

  return (
    <main className="mx-auto max-w-6xl p-6">
      <header className="mb-6 max-w-3xl">
        <p className="text-sm font-medium text-brand">Release 1 demo</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Candidate Pack</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Paste one document-request item. Confirm the interpreted scope, review candidate
          evidence, acknowledge gaps, then approve — attestation is written to the audit log.
        </p>
      </header>
      <CandidatePackClient />
    </main>
  );
}
