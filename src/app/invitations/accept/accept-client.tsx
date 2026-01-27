"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Alert, AlertDescription } from "~/components/ui/alert";

export default function AcceptInvitationClient({ token }: { token?: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const signedInEmail = session?.user?.email ?? null;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<{
    workspaceName: string;
    role: string;
    email: string;
  } | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Invalid invitation link");
      return;
    }

    // Fetch invitation details
    fetch(`/api/invitations/verify?token=${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setInvitation(data.invitation);
        }
      })
      .catch((err) => {
        setError("Failed to verify invitation");
        console.error(err);
      });
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;

    setIsLoading(true);
    setError(null);

    try {
      // Accept invitation (creates UserWorkspace record)
      const response = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to accept invitation");
      }

      // Redirect to sign in (user will be added to workspace after auth)
      const data = await response.json();
      if (data.requiresAuth) {
        // User needs to sign in first
        await signIn(undefined, {
          callbackUrl: `/invitations/accept?token=${token}`,
        });
      } else {
        // User is already authenticated, redirect to dashboard
        router.push("/dashboard");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invalid Invitation</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">This invitation link is invalid.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Accept Invitation</CardTitle>
          {invitation && (
            <CardDescription>
              You&apos;ve been invited to join <strong>{invitation.workspaceName}</strong> as a{" "}
              <strong>{invitation.role === "OWNER_CCO" ? "Owner/CCO" : "Member"}</strong>
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {invitation && (
            <div className="space-y-1 text-xs text-muted-foreground">
              <div>
                Invited email: <span className="font-medium text-foreground">{invitation.email}</span>
              </div>
              <div>
                Signed in as:{" "}
                <span className="font-medium text-foreground">
                  {signedInEmail ?? "Not signed in"}
                </span>
              </div>
            </div>
          )}

          {invitation && (
            <Button
              onClick={handleAccept}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? "Accepting..." : "Accept Invitation"}
            </Button>
          )}

          {invitation && signedInEmail && signedInEmail !== invitation.email && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() =>
                signOut({
                  callbackUrl: `/invitations/accept?token=${token}`,
                })
              }
            >
              Sign in with a different email
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

