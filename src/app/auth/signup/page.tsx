import { redirect } from "next/navigation";
import { buildBillingIntentQuery, parseBillingIntent } from "~/lib/billing-intent";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string; currency?: string; onboarding?: string }>;
}) {
  const params = await searchParams;
  const intentParams = parseBillingIntent(params);
  const intentQuery = buildBillingIntentQuery(intentParams);

  redirect(`/auth/signin${intentQuery}`);
}
