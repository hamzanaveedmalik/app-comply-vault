import { stripe } from "~/server/stripe";
import SuccessClient from "./success-client";
import { db } from "~/server/db";

export const runtime = "nodejs";

export default async function BillingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const params = await searchParams;
  const sessionId = params.session_id;

  if (!sessionId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-2xl font-semibold">Missing session</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We could not verify your payment session.
        </p>
      </div>
    );
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const workspaceId = session.metadata?.workspaceId ?? null;
  const plan = session.metadata?.plan ?? null;
  const onboardingType = session.metadata?.onboarding ?? "NONE";

  if (!workspaceId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-2xl font-semibold">Unable to verify workspace</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The payment session is missing workspace details.
        </p>
      </div>
    );
  }

  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { stripeCustomerId: true },
  });

  if (!workspace) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-2xl font-semibold">Workspace not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The payment session does not match a valid workspace.
        </p>
      </div>
    );
  }

  if (workspace.stripeCustomerId && session.customer !== workspace.stripeCustomerId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-2xl font-semibold">Unable to verify payment</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The payment session does not match this workspace.
        </p>
      </div>
    );
  }

  return (
    <SuccessClient
      workspaceId={workspaceId}
      plan={plan}
      onboardingType={onboardingType}
    />
  );
}
