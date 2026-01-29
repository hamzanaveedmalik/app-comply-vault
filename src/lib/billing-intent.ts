import { z } from "zod";

const billingIntentSchema = z.object({
  intent: z.enum(["trial", "solo", "team"]).optional(),
  currency: z.enum(["USD", "GBP"]).optional(),
  onboarding: z.enum(["none", "standard", "premium"]).optional(),
});

export type BillingIntentParams = z.infer<typeof billingIntentSchema>;

type RawParams =
  | URLSearchParams
  | Record<string, string | string[] | undefined | null>;

const getParam = (params: RawParams, key: string) => {
  if (params instanceof URLSearchParams) {
    return params.get(key) ?? undefined;
  }
  const value = params[key];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value ?? undefined;
};

export const parseBillingIntent = (params: RawParams): BillingIntentParams => {
  const parsed = billingIntentSchema.safeParse({
    intent: getParam(params, "intent"),
    currency: getParam(params, "currency"),
    onboarding: getParam(params, "onboarding"),
  });

  if (!parsed.success) {
    return {};
  }

  return parsed.data;
};

export const buildBillingIntentQuery = (params: BillingIntentParams) => {
  const search = new URLSearchParams();
  if (params.intent) search.set("intent", params.intent);
  if (params.currency) search.set("currency", params.currency);
  if (params.onboarding) search.set("onboarding", params.onboarding);
  const query = search.toString();
  return query ? `?${query}` : "";
};
