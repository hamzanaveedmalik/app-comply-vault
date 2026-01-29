import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { z } from "zod";
import { sendWelcomeEmail } from "~/server/email";
import { cookies } from "next/headers";
import { stripe } from "~/server/stripe";
import { getOnboardingTypeFromLineItems, getPlanFromLineItems } from "~/server/billing/stripe-utils";

const createWorkspaceSchema = z.object({
  name: z.string().min(1, "Workspace name is required").max(100),
  intent: z.enum(["trial", "solo", "team"]).optional(),
  currency: z.enum(["USD", "GBP"]).optional(),
  onboarding: z.enum(["none", "standard", "premium"]).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await request.json();
    const { name, intent, currency, onboarding } =
      createWorkspaceSchema.parse(body);

    await db.user.upsert({
      where: { id: session.user.id },
      create: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        image: session.user.image,
      },
      update: {
        email: session.user.email,
        name: session.user.name,
        image: session.user.image,
      },
    });

    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip");
    const userAgent = request.headers.get("user-agent");

    const pilotStartDate = new Date();

    // Create workspace with pilot provisioning
    const now = new Date();
    const billingCurrency = currency ?? "USD";
    const onboardingType =
      onboarding && onboarding !== "none" ? onboarding.toUpperCase() : null;
    const isTrialIntent = intent === "trial" || intent === "solo" || intent === "team";
    const trialStartedAt = isTrialIntent ? now : null;
    const trialEndsAt = isTrialIntent
      ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 7, 0, 0, 0))
      : null;
    const planTier =
      intent === "solo" ? "SOLO" : intent === "team" ? "TEAM" : "FREE";

    const workspace = await db.workspace.create({
      data: {
        name,
        retentionYears: 6, // Default per SEC requirement + buffer
        legalHold: false,
        billingStatus: isTrialIntent ? "TRIALING" : "PILOT",
        planTier,
        billingCurrency,
        pilotStartDate: isTrialIntent ? null : pilotStartDate,
        trialStartedAt,
        trialEndsAt,
        onboardingType,
        users: {
          create: {
            userId: session.user.id,
            role: "OWNER_CCO",
          },
        },
      },
    });

    // Log workspace creation
    await db.auditEvent.create({
      data: {
        workspaceId: workspace.id,
        userId: session.user.id,
        action: "WORKSPACE_CREATED",
        resourceType: "workspace",
        resourceId: workspace.id,
        metadata: {
          workspaceName: name,
          action: "workspace_created",
          pilotStartDate: pilotStartDate.toISOString(),
          ipAddress,
          userAgent,
        },
      },
    });

    // Send welcome email with onboarding checklist
    if (session.user.email) {
      try {
        await sendWelcomeEmail({
          email: session.user.email,
          workspaceName: name,
          userName: session.user.name || "there",
        });
      } catch (emailError) {
        // Don't fail workspace creation if email fails
        console.error("Error sending welcome email:", emailError);
      }
    }

    const checkoutCookie = (await cookies()).get("cv_checkout_context")?.value;
    if (checkoutCookie) {
      try {
        const decoded = decodeURIComponent(checkoutCookie);
        const data = JSON.parse(decoded) as {
          sessionId?: string;
          plan?: "SOLO" | "TEAM" | null;
          currency?: "USD" | "GBP" | null;
          onboarding?: "STANDARD" | "PREMIUM" | null;
        };

        if (data.sessionId) {
          const session = await stripe.checkout.sessions.retrieve(data.sessionId);
          const lineItems = await stripe.checkout.sessions.listLineItems(data.sessionId, {
            limit: 100,
          });
          const planFromItems = getPlanFromLineItems(lineItems);
          const onboardingFromItems = getOnboardingTypeFromLineItems(lineItems);
          const planTier = data.plan ?? planFromItems;
          const onboardingType = data.onboarding ?? onboardingFromItems;

          const subscriptionId =
            typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
          const subscription =
            subscriptionId && typeof session.subscription === "string"
              ? await stripe.subscriptions.retrieve(subscriptionId)
              : session.subscription;

          if (subscriptionId) {
            await stripe.subscriptions.update(subscriptionId, {
              metadata: {
                workspaceId: workspace.id,
                plan: planTier ?? "SOLO",
                currency: (data.currency ?? session.currency?.toUpperCase() ?? "USD") as string,
              },
            });
          }

          await db.workspace.update({
            where: { id: workspace.id },
            data: {
              stripeCustomerId: (session.customer as string) ?? undefined,
              stripeSubscriptionId: subscriptionId ?? undefined,
              billingStatus: subscriptionId ? "ACTIVE" : workspace.billingStatus,
              planTier: planTier ?? workspace.planTier,
              billingCurrency: (data.currency ??
                session.currency?.toUpperCase() ??
                workspace.billingCurrency) as "USD" | "GBP",
              currentPeriodStart: subscription
                ? new Date(subscription.current_period_start * 1000)
                : undefined,
              currentPeriodEnd: subscription
                ? new Date(subscription.current_period_end * 1000)
                : undefined,
              subscriptionStartDate: subscription
                ? new Date(subscription.start_date * 1000)
                : undefined,
              onboardingType,
              onboardingPaidAt: onboardingType ? new Date() : undefined,
            },
          });
        }
      } catch (error) {
        console.error("Error applying checkout session to workspace:", error);
      } finally {
        (await cookies()).set("cv_checkout_context", "", {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: 0,
        });
      }
    }

    return Response.json(
      {
        workspace: {
          id: workspace.id,
          name: workspace.name,
          retentionYears: workspace.retentionYears,
          billingStatus: workspace.billingStatus,
          pilotStartDate: workspace.pilotStartDate,
        },
        message: "Workspace created successfully! Check your email for onboarding instructions.",
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error creating workspace:", error);
    return Response.json(
      { error: "Failed to create workspace" },
      { status: 500 }
    );
  }
}

