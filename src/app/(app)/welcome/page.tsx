import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { redirect } from "next/navigation";
import { getEntitlements, isTrialExpired } from "~/server/billing/entitlements";
import WelcomeClient from "./welcome-client";

function getUsageWindow(currentPeriodStart: Date | null, currentPeriodEnd: Date | null) {
  if (currentPeriodStart && currentPeriodEnd) {
    return { start: currentPeriodStart, end: currentPeriodEnd };
  }
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0));
  return { start, end };
}

export default async function WelcomePage() {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    redirect("/workspaces/new");
  }

  const workspace = await db.workspace.findUnique({
    where: { id: session.user.workspaceId },
  });

  if (!workspace) {
    redirect("/workspaces/new");
  }

  const entitlements = getEntitlements(workspace);
  const { start, end } = getUsageWindow(workspace.currentPeriodStart, workspace.currentPeriodEnd);

  const uploadsUsed = await db.meeting.count({
    where: {
      workspaceId: workspace.id,
      createdAt: { gte: start, lt: end },
    },
  });

  const membersCount = await db.userWorkspace.count({
    where: { workspaceId: workspace.id },
  });

  const trialExpired =
    workspace.billingStatus === "TRIALING" && isTrialExpired(workspace.trialEndsAt);

  const trialDaysRemaining =
    workspace.billingStatus === "TRIALING" && workspace.trialEndsAt
      ? Math.max(
          0,
          Math.ceil((workspace.trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        )
      : null;

  return (
    <WelcomeClient
      workspace={{
        id: workspace.id,
        name: workspace.name,
        billingStatus: workspace.billingStatus,
        planTier: workspace.planTier,
        billingCurrency: workspace.billingCurrency,
        onboardingType: workspace.onboardingType,
        trialEndsAt: workspace.trialEndsAt?.toISOString() ?? null,
      }}
      entitlements={entitlements}
      usage={{
        uploadsUsed,
        membersCount,
      }}
      trialExpired={trialExpired}
      trialDaysRemaining={trialDaysRemaining}
    />
  );
}
