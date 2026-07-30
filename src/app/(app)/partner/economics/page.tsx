import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { isRelease1DemoEnabled } from "~/lib/feature-flags";
import { requireAppAccess } from "~/server/auth/guards";

const commercialShapes = [
  { title: "Referral", price: "$1,000 per converted firm", detail: "A simple fee paid after a referred adviser firm becomes a customer." },
  { title: "Volume licence", price: "$300 per adviser per year", detail: "A platform-wide licence priced across the adviser base, with annual true-up." },
  { title: "White-label", price: "30% partner margin", detail: "The partner bills advisers at its chosen price and retains a 30% margin." },
];

export default async function PartnerEconomicsPage(): Promise<React.JSX.Element> {
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
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Partner economics</h1>
        <p className="mt-2 text-sm text-muted-foreground">Three commercial shapes to test, not a committed price book.</p>
      </header>
      <div className="grid gap-4 md:grid-cols-3">
        {commercialShapes.map((shape) => (
          <Card key={shape.title}>
            <CardHeader><CardTitle>{shape.title}</CardTitle><CardDescription className="text-brand">{shape.price}</CardDescription></CardHeader>
            <CardContent className="text-sm text-muted-foreground">{shape.detail}</CardContent>
          </Card>
        ))}
      </div>
      <Card className="mt-6 border-brand/30">
        <CardHeader><CardTitle>Pilot proposal</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Free pilot with two or three partner firms.</p>
          <p>Success criteria: evidence retrieval, candidate-pack review time, and the usefulness of named portfolio exposure factors.</p>
          <p>First engineering act: production partner access with enforced isolation guarantees.</p>
          <p className="font-medium text-foreground">Next step: select pilot firms and commercial shape by 17 August 2026.</p>
        </CardContent>
      </Card>
    </main>
  );
}
