import Stripe from "stripe";
import { env } from "~/env";

// Lazy initialization to avoid build-time errors
// Stripe will be initialized on first use
let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is required. Please set it in your environment variables.");
    }
    stripeInstance = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-06-20",
    });
  }
  return stripeInstance;
}

// Export for backward compatibility - lazy initialization
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const instance = getStripe();
    const value = instance[prop as keyof Stripe];
    // Handle methods that need to be bound
    if (typeof value === "function") {
      return value.bind(instance);
    }
    return value;
  },
});
