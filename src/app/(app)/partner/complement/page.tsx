import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { isRelease1DemoEnabled } from "~/lib/feature-flags";
import { requireAppAccess } from "~/server/auth/guards";

const complements = [
  {
    name: "Hadrius",
    does: "Marketing-review workflow and approval support.",
    doesNot: "Does not assemble a source-linked supervision evidence trail.",
    complyVault: "ComplyVault preserves and retrieves the underlying communication and review evidence.",
  },
  {
    name: "Zocks",
    does: "Meeting intelligence and adviser workflow automation.",
    doesNot: "Does not provide a compliance evidence chain across channels.",
    complyVault: "ComplyVault connects source evidence, what surfaced, review decisions, and closure evidence.",
  },
  {
    name: "FastTrackr AI",
    does: "AI-assisted operational and practice workflows.",
    doesNot: "Does not provide examination-request scope confirmation and candidate evidence assembly.",
    complyVault: "ComplyVault interprets a request, requires CCO confirmation, and produces a reviewable candidate pack.",
  },
];

export default async function PartnerComplementPage(): Promise<React.JSX.Element> {
  if (!isRelease1DemoEnabled()) redirect("/dashboard");
  const access = await requireAppAccess();
  if (!access.ok) {
    if (access.status === 401) redirect("/auth/signin");
    return <div className="p-6 text-destructive">{access.error}</div>;
  }
  if (access.session.user.role !== "OWNER_CCO") redirect("/dashboard");

  return (
    <main className="mx-auto max-w-5xl p-6">
      <header className="mb-6">
        <p className="text-sm font-medium text-brand">Commercial proposition</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Complement map</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          ComplyVault completes the stack; it is not positioned as a replacement.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-3">
        {complements.map((item) => (
          <Card key={item.name}>
            <CardHeader><CardTitle>{item.name}</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div><p className="font-medium">What it does</p><p className="mt-1 text-muted-foreground">{item.does}</p></div>
              <div><p className="font-medium">What it does not do</p><p className="mt-1 text-muted-foreground">{item.doesNot}</p></div>
              <div><p className="font-medium text-brand">ComplyVault’s job</p><p className="mt-1 text-muted-foreground">{item.complyVault}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
