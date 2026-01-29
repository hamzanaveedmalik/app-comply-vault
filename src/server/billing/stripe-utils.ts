import type Stripe from "stripe";
import { env } from "~/env";

export type StripePlanTier = "SOLO" | "TEAM";
export type StripeOnboardingType = "STANDARD" | "PREMIUM";

export const PLAN_PRICE_IDS: Record<StripePlanTier, Record<"USD" | "GBP", string | undefined>> = {
  SOLO: {
    USD: env.STRIPE_PRICE_SOLO_USD,
    GBP: env.STRIPE_PRICE_SOLO_GBP,
  },
  TEAM: {
    USD: env.STRIPE_PRICE_TEAM_USD,
    GBP: env.STRIPE_PRICE_TEAM_GBP,
  },
};

export const ONBOARDING_PRICE_IDS: Record<
  StripeOnboardingType,
  Record<"USD" | "GBP", string | undefined>
> = {
  STANDARD: {
    USD: env.STRIPE_ONBOARDING_STANDARD_USD,
    GBP: env.STRIPE_ONBOARDING_STANDARD_GBP,
  },
  PREMIUM: {
    USD: env.STRIPE_ONBOARDING_PREMIUM_USD,
    GBP: env.STRIPE_ONBOARDING_PREMIUM_GBP,
  },
};

export const getPlanFromLineItems = (
  lineItems: Stripe.ApiList<Stripe.LineItem>
): StripePlanTier | null => {
  for (const item of lineItems.data) {
    const priceId = item.price?.id;
    if (!priceId) {
      continue;
    }
    if (
      priceId === env.STRIPE_PRICE_SOLO_USD ||
      priceId === env.STRIPE_PRICE_SOLO_GBP
    ) {
      return "SOLO";
    }
    if (
      priceId === env.STRIPE_PRICE_TEAM_USD ||
      priceId === env.STRIPE_PRICE_TEAM_GBP
    ) {
      return "TEAM";
    }
  }
  return null;
};

export const getOnboardingTypeFromLineItems = (
  lineItems: Stripe.ApiList<Stripe.LineItem>
): StripeOnboardingType | null => {
  for (const item of lineItems.data) {
    const priceId = item.price?.id;
    if (!priceId) {
      continue;
    }
    if (
      priceId === env.STRIPE_ONBOARDING_STANDARD_USD ||
      priceId === env.STRIPE_ONBOARDING_STANDARD_GBP
    ) {
      return "STANDARD";
    }
    if (
      priceId === env.STRIPE_ONBOARDING_PREMIUM_USD ||
      priceId === env.STRIPE_ONBOARDING_PREMIUM_GBP
    ) {
      return "PREMIUM";
    }
  }
  return null;
};
