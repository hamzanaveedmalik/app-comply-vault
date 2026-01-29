"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";

type SuccessClientProps = {
  workspaceId: string;
  plan: string | null;
  onboardingType: string;
};

const getRedirectTarget = (plan: string | null, onboardingType: string) => {
  const normalized = onboardingType.toLowerCase();
  if (normalized === "premium") {
    return "/app/onboarding/premium";
  }
  if (normalized === "standard") {
    return "/app/onboarding";
  }
  if (plan?.toUpperCase() === "TEAM") {
    return "/app/team";
  }
  return "/app/meetings";
};

export default function SuccessClient({ workspaceId, plan, onboardingType }: SuccessClientProps) {
  const router = useRouter();
  const [message, setMessage] = useState("Confirming your subscription...");

  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 12;
    const poll = async () => {
      try {
        const response = await fetch(`/api/billing/status?workspaceId=${workspaceId}`);
        if (!response.ok) {
          throw new Error("Failed to check billing status");
        }
        const data = await response.json();
        if (data.billingStatus === "ACTIVE") {
          const target = getRedirectTarget(plan, data.onboardingType ?? onboardingType);
          router.replace(target);
          return;
        }
        setMessage("Finalizing your subscription details...");
      } catch (error) {
        setMessage("Still confirming your subscription...");
      }

      attempts += 1;
      if (attempts >= maxAttempts) {
        router.replace("/welcome");
        return;
      }
      setTimeout(poll, 2500);
    };

    poll();
    return () => {
      attempts = maxAttempts;
    };
  }, [onboardingType, plan, router, workspaceId]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Payment received</CardTitle>
          <CardDescription>
            We&apos;re activating your workspace. This usually takes a few seconds.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{message}</p>
        </CardContent>
      </Card>
    </div>
  );
}
