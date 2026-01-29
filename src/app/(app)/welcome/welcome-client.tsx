"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Label } from "~/components/ui/label";

type WelcomeProps = {
  workspace: {
    id: string;
    name: string;
    billingStatus: string;
    planTier: string;
    billingCurrency: string;
    onboardingType: string | null;
    trialEndsAt: string | null;
  };
  entitlements: {
    maxUsers: number;
    maxUploadsPerPeriod: number;
    allowApiAccess: boolean;
    allowZipExport: boolean;
    exportsWatermarked: boolean;
  };
  usage: {
    uploadsUsed: number;
    membersCount: number;
  };
  trialExpired: boolean;
  trialDaysRemaining: number | null;
};

export default function WelcomeClient({
  workspace,
  entitlements,
  usage,
  trialExpired,
  trialDaysRemaining,
}: WelcomeProps) {
  const [currency, setCurrency] = useState(workspace.billingCurrency);
  const initialOnboarding =
    workspace.onboardingType?.toLowerCase() === "standard" ||
    workspace.onboardingType?.toLowerCase() === "premium"
      ? workspace.onboardingType.toLowerCase()
      : "none";
  const [onboarding, setOnboarding] = useState(initialOnboarding);
  const initialPlan = workspace.planTier === "TEAM" ? "TEAM" : "SOLO";
  const [plan, setPlan] = useState<"SOLO" | "TEAM">(initialPlan);
  const [isLoading, setIsLoading] = useState(false);

  const handleUpgrade = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspaceId: workspace.id,
          plan,
          currency,
          onboarding: onboarding.toUpperCase(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to start checkout");
      }

      const data = await response.json();
      window.location.href = data.url;
    } catch (error) {
      console.error("Checkout error:", error);
      alert(error instanceof Error ? error.message : "Failed to start checkout");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Welcome to Comply Vault</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {workspace.billingStatus === "TRIALING"
            ? `Trial workspace for ${workspace.name}`
            : `Workspace: ${workspace.name}`}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trial status</CardTitle>
          <CardDescription>
            {workspace.billingStatus === "TRIALING"
              ? trialExpired
                ? "Trial expired — upgrade to continue using paid features."
                : `Trial active — ${trialDaysRemaining ?? 0} day(s) remaining.`
              : "Billing not in trial mode."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">
              Uploads: {usage.uploadsUsed}/{entitlements.maxUploadsPerPeriod}
            </Badge>
            <Badge variant="outline">Members: {usage.membersCount}/{entitlements.maxUsers}</Badge>
            {entitlements.exportsWatermarked && (
              <Badge variant="secondary">Exports watermarked</Badge>
            )}
          </div>
          {workspace.billingStatus === "TRIALING" && (
            <p className="text-xs text-muted-foreground">
              Exports are watermarked during trial.
            </p>
          )}
        </CardContent>
      </Card>

      {workspace.billingStatus === "ACTIVE" ? (
        <Card>
          <CardHeader>
            <CardTitle>Workspace active</CardTitle>
            <CardDescription>Your subscription is active.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => (window.location.href = "/meetings")}>
              Go to meetings
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Upgrade your plan</CardTitle>
            <CardDescription>Select plan, currency, and onboarding.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Plan</Label>
                <Select value={plan} onValueChange={(value) => setPlan(value as "SOLO" | "TEAM")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SOLO">Solo</SelectItem>
                    <SelectItem value="TEAM">Team</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Onboarding</Label>
                <Select value={onboarding} onValueChange={setOnboarding}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select onboarding" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex">
              <Button onClick={handleUpgrade} disabled={isLoading} className="w-full">
                {isLoading ? "Redirecting..." : "Upgrade"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
