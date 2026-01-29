import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { z } from "zod";
import { stripe } from "~/server/stripe";
import { env } from "~/env";

const checkoutSchema = z.object({
  workspaceId: z.string(),
  plan: z.enum(["SOLO", "TEAM"]),
  currency: z.enum(["USD", "GBP"]),
  onboarding: z.enum(["NONE", "STANDARD", "PREMIUM"]).optional(),
});

// Env price IDs expected:
// STRIPE_PRICE_SOLO_USD/GBP, STRIPE_PRICE_TEAM_USD/GBP
// STRIPE_ONBOARDING_STANDARD_USD/GBP, STRIPE_ONBOARDING_PREMIUM_USD/GBP
const PRICE_MAP = {
  SOLO: {
    USD: env.STRIPE_PRICE_SOLO_USD,
    GBP: env.STRIPE_PRICE_SOLO_GBP,
  },
  TEAM: {
    USD: env.STRIPE_PRICE_TEAM_USD,
    GBP: env.STRIPE_PRICE_TEAM_GBP,
  },
} as const;

const ONBOARDING_PRICE_MAP = {
  STANDARD: {
    USD: env.STRIPE_ONBOARDING_STANDARD_USD,
    GBP: env.STRIPE_ONBOARDING_STANDARD_GBP,
  },
  PREMIUM: {
    USD: env.STRIPE_ONBOARDING_PREMIUM_USD,
    GBP: env.STRIPE_ONBOARDING_PREMIUM_GBP,
  },
} as const;

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.workspaceId || !session.user.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "OWNER_CCO") {
      return Response.json(
        { error: "Only Owner/CCO can manage billing" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { workspaceId, plan, currency, onboarding } = checkoutSchema.parse(body);

    if (workspaceId !== session.user.workspaceId) {
      return Response.json({ error: "Workspace access denied" }, { status: 403 });
    }

    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      return Response.json({ error: "Workspace not found" }, { status: 404 });
    }

    const priceId = PRICE_MAP[plan][currency];
    if (!priceId) {
      return Response.json({ error: "Price configuration missing" }, { status: 400 });
    }

    const baseUrl = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const lineItems = [
      {
        price: priceId,
        quantity: 1,
      },
    ];

    if (onboarding && onboarding !== "NONE") {
      const onboardingPrice =
        ONBOARDING_PRICE_MAP[onboarding]?.[currency];
      if (!onboardingPrice) {
        return Response.json({ error: "Onboarding price missing" }, { status: 400 });
      }
      lineItems.push({
        price: onboardingPrice,
        quantity: 1,
      });
    }

    let customerId = workspace.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: workspace.name,
        email: session.user.email ?? undefined,
        metadata: {
          workspaceId,
        },
      });
      customerId = customer.id;
      await db.workspace.update({
        where: { id: workspaceId },
        data: {
          stripeCustomerId: customerId,
        },
      });
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: lineItems,
      success_url: `${baseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/app/welcome?checkout=cancelled`,
      metadata: {
        workspaceId,
        plan,
        currency,
        onboarding: onboarding ?? "NONE",
      },
      subscription_data: {
        metadata: {
          workspaceId,
          plan,
          currency,
        },
      },
    });

    return Response.json({ url: checkoutSession.url });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.errors }, { status: 400 });
    }
    console.error("Checkout error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to create checkout" },
      { status: 500 }
    );
  }
}
