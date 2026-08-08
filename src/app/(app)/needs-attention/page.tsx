import { redirect } from "next/navigation";
import { NeedsAttentionSection } from "~/components/needs-attention/needs-attention-section";
import { isRelease1DemoEnabled } from "~/lib/feature-flags";
import { requireAppAccess } from "~/server/auth/guards";
import { listNeedsAttention } from "~/server/needs-attention/list";

export default async function NeedsAttentionPage(): Promise<React.JSX.Element> {
  if (!isRelease1DemoEnabled()) redirect("/dashboard");

  const access = await requireAppAccess();
  if (!access.ok) {
    if (access.status === 401) redirect("/auth/signin");
    return <div className="p-6 text-destructive">{access.error}</div>;
  }

  const items = await listNeedsAttention(access.workspaceId);
  return (
    <main className="mx-auto max-w-5xl p-6">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Needs Attention</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Items are ordered by severity and age. Each card shows the available evidence,
          what is missing, and the next expected action.
        </p>
      </header>
      <NeedsAttentionSection items={items} />
    </main>
  );
}
