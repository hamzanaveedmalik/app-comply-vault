import { headers } from "next/headers";
import { stripe } from "~/server/stripe";
import type Stripe from "stripe";
import { env } from "~/env";
import { db } from "~/server/db";
import { getOnboardingTypeFromLineItems } from "~/server/billing/stripe-utils";

export const runtime = "nodejs";

function mapSubscriptionStatus(status: string) {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "trialing":
      return "TRIALING";
    case "past_due":
      return "PAST_DUE";
    case "canceled":
    case "unpaid":
      return "CANCELED";
    default:
      return "ACTIVE";
  }
}

// Env vars used:
// STRIPE_WEBHOOK_SECRET, STRIPE_ONBOARDING_STANDARD_USD/GBP, STRIPE_ONBOARDING_PREMIUM_USD/GBP

export async function POST(request: Request) {
  const body = await request.text();
  const signature = (await headers()).get("stripe-signature");

  if (!env.STRIPE_WEBHOOK_SECRET || !signature) {
    return Response.json({ error: "Webhook secret not configured" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const workspaceId = session.metadata?.workspaceId;
      const plan = session.metadata?.plan as "SOLO" | "TEAM" | undefined;
      const currency = session.metadata?.currency as "USD" | "GBP" | undefined;

      if (workspaceId) {
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
          limit: 100,
        });
        const onboardingType = getOnboardingTypeFromLineItems(lineItems);

        await db.workspace.update({
          where: { id: workspaceId },
          data: {
            billingStatus: "ACTIVE",
            planTier: plan ?? "SOLO",
            billingCurrency: currency ?? "USD",
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
            subscriptionStartDate: new Date(),
            onboardingType,
            onboardingPaidAt: onboardingType ? new Date() : null,
          },
        });
      }
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const subscription = event.data.object as Stripe.Subscription;
      const workspaceId = subscription.metadata?.workspaceId;
      if (workspaceId) {
        await db.workspace.update({
          where: { id: workspaceId },
          data: {
            billingStatus: mapSubscriptionStatus(subscription.status),
            planTier: (subscription.metadata?.plan as "SOLO" | "TEAM") ?? "SOLO",
            billingCurrency: subscription.currency.toUpperCase() as "USD" | "GBP",
            stripeCustomerId: subscription.customer as string,
            stripeSubscriptionId: subscription.id,
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            subscriptionStartDate: subscription.start_date
              ? new Date(subscription.start_date * 1000)
              : undefined,
          },
        });
      }
    }

    if (event.type === "invoice.payment_succeeded" || event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.subscription as string | null;
      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const workspaceId = subscription.metadata?.workspaceId;
        if (workspaceId) {
          await db.workspace.update({
            where: { id: workspaceId },
            data: {
              billingStatus:
                event.type === "invoice.payment_failed"
                  ? "PAST_DUE"
                  : mapSubscriptionStatus(subscription.status),
              currentPeriodStart: new Date(subscription.current_period_start * 1000),
              currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            },
          });
        }
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Webhook handler failed" },
      { status: 500 }
    );
  }
}
