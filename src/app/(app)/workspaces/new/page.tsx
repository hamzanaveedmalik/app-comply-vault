"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Separator } from "~/components/ui/separator";

export default function NewWorkspacePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pilotCode, setPilotCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          name,
          pilotCode: pilotCode.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create workspace");
      }

      const data = await response.json();
      
      // Check if setup fee is required
      if (data.setupFee > 0) {
        // Show message with demo code option
        setSuccess(
          `Workspace created! Use demo code "FREEPILOT" to skip the $500 setup fee. Redirecting to dashboard...`
        );
        // Force full page reload to refresh session with new workspace
        setTimeout(() => {
          window.location.href = "/dashboard";
        }, 3000);
      } else {
        // No setup fee, redirect immediately with full reload
        setSuccess(data.message || "Workspace created successfully! Redirecting...");
        setTimeout(() => {
          window.location.href = "/dashboard";
        }, 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create Your Pilot Workspace</CardTitle>
          <CardDescription>
            Set up your firm&apos;s compliance documentation system. Start your 60-day free pilot period.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Workspace Name</Label>
              <Input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder='e.g., "Smith Financial Advisors"'
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground">
                This will be your firm&apos;s workspace name
              </p>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="pilotCode">Pilot Code (Optional)</Label>
              <Input
                id="pilotCode"
                type="text"
                value={pilotCode}
                onChange={(e) => setPilotCode(e.target.value)}
                placeholder="Enter pilot code (e.g., FREEPILOT)"
              />
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  Enter a pilot code to skip the $500 setup fee. 
                </p>
                <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                  <p className="text-xs font-medium">Demo Code:</p>
                  <code className="text-xs bg-background px-2 py-1 rounded font-mono">FREEPILOT</code>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => {
                      setPilotCode("FREEPILOT");
                    }}
                  >
                    Use
                  </Button>
                </div>
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert>
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Button
                type="submit"
                disabled={isLoading || !name.trim()}
                className="w-full"
              >
                {isLoading ? "Creating..." : "Create Pilot Workspace"}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                By creating a workspace, you agree to start your 60-day free pilot period.
                {!pilotCode.trim() && " A $500 setup fee will be required to activate."}
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}


