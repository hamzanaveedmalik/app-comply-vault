import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { getEntitlements, isPaywallBypassed, isTrialExpired, type Entitlements } from "~/server/billing/entitlements";

/**
 * Workspace fields returned by requireAppAccess
 */
export type WorkspaceAccessFields = {
  id: string;
  name: string;
  billingStatus: "PILOT" | "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED";
  planTier: "FREE" | "SOLO" | "TEAM";
  trialEndsAt: Date | null;
  billingCurrency: "USD" | "GBP";
};

/**
 * Result type for requireAppAccess guard
 */
export type AppAccessResult =
  | {
      ok: true;
      session: Awaited<ReturnType<typeof auth>>;
      workspaceId: string;
      workspace: WorkspaceAccessFields;
      entitlements: Entitlements;
      trialExpired: boolean;
    }
  | { ok: false; status: 401 | 403 | 402; error: string };

/**
 * Shared guard function that enforces app domain access control.
 * 
 * Requirements:
 * 1. Authenticated session
 * 2. Email verified
 * 3. Workspace membership
 * 4. Entitlements: trial active or paid subscription
 * 
 * This should be used in all protected API routes and server actions.
 * Middleware can redirect for UX but is NOT security - this guard is the security.
 * 
 * @returns AppAccessResult with session and workspaceId if access granted, or error details
 */
export async function requireAppAccess(): Promise<AppAccessResult> {
  const session = await auth();

  // 1. Check authentication
  if (!session?.user) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized: Authentication required",
    };
  }

  // 2. Check email verification
  if (!session.user.email) {
    return {
      ok: false,
      status: 403,
      error: "Email address required",
    };
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { emailVerified: true },
  });

  if (!user?.emailVerified) {
    return {
      ok: false,
      status: 403,
      error: "Email verification required. Please verify your email address.",
    };
  }

  // 3. Check workspace membership
  if (!session.user.workspaceId) {
    return {
      ok: false,
      status: 403,
      error: "Workspace membership required",
    };
  }

  // Verify workspace exists and user is a member
  const workspace = await db.workspace.findFirst({
    where: {
      id: session.user.workspaceId,
      users: {
        some: {
          userId: session.user.id,
        },
      },
    },
    select: {
      id: true,
      name: true,
      billingStatus: true,
      planTier: true,
      trialEndsAt: true,
      billingCurrency: true,
    },
  });

  if (!workspace) {
    return {
      ok: false,
      status: 403,
      error: "Workspace not found or access denied",
    };
  }

  // Calculate entitlements and trial status
  // getEntitlements always returns a value (fallback to ENTITLEMENTS.FREE)
  const entitlements = getEntitlements({
    billingStatus: workspace.billingStatus,
    planTier: workspace.planTier,
    trialEndsAt: workspace.trialEndsAt,
  }) as Entitlements;
  const trialExpired =
    workspace.billingStatus === "TRIALING" && isTrialExpired(workspace.trialEndsAt);

  // 4. Check entitlements: trial active or paid subscription
  // Allow PILOT status (paywall bypassed) for internal/testing
  if (isPaywallBypassed(workspace.billingStatus)) {
    return {
      ok: true as const,
      session,
      workspaceId: workspace.id,
      workspace: workspace as WorkspaceAccessFields,
      entitlements,
      trialExpired: false,
    };
  }

  // Check if trial is active
  const isTrialActive =
    workspace.billingStatus === "TRIALING" && !trialExpired;

  // Check if subscription is active
  const isSubscriptionActive = workspace.billingStatus === "ACTIVE";

  if (!isTrialActive && !isSubscriptionActive) {
    // Trial expired or subscription inactive
    if (workspace.billingStatus === "TRIALING" && trialExpired) {
      return {
        ok: false as const,
        status: 402 as const,
        error: "Trial expired. Please upgrade to continue using the app.",
      };
    }

    return {
      ok: false as const,
      status: 402 as const,
      error: "Subscription inactive. Please update billing to continue using the app.",
    };
  }

  // All checks passed
  return {
    ok: true as const,
    session,
    workspaceId: workspace.id,
    workspace: workspace as WorkspaceAccessFields,
    entitlements,
    trialExpired,
  };
}

/**
 * Lighter guard for routes that require authentication and email verification
 * but NOT workspace membership (e.g., workspace creation).
 * 
 * @returns AppAccessResult with session if access granted, or error details
 */
export async function requireAuthAndEmailVerified(): Promise<
  | { ok: true; session: Awaited<ReturnType<typeof auth>> }
  | { ok: false; status: 401 | 403; error: string }
> {
  const session = await auth();

  // 1. Check authentication
  if (!session?.user) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized: Authentication required",
    };
  }

  // 2. Check email verification
  if (!session.user.email) {
    return {
      ok: false,
      status: 403,
      error: "Email address required",
    };
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { emailVerified: true },
  });

  if (!user?.emailVerified) {
    return {
      ok: false,
      status: 403,
      error: "Email verification required. Please verify your email address.",
    };
  }

  return {
    ok: true,
    session,
  };
}
