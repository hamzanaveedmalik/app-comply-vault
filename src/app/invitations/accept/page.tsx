"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

function AcceptInvitationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

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
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Invalid Invitation</h1>
          <p className="mt-2 text-gray-600">This invitation link is invalid.</p>
        </div>
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Error</h1>
          <p className="mt-2 text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-md">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Accept Invitation</h2>
          {invitation && (
            <p className="mt-2 text-sm text-gray-600">
              You&apos;ve been invited to join <strong>{invitation.workspaceName}</strong> as a{" "}
              <strong>{invitation.role === "OWNER_CCO" ? "Owner/CCO" : "Member"}</strong>
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-3">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {invitation && (
          <button
            onClick={handleAccept}
            disabled={isLoading}
            className="w-full rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Accepting..." : "Accept Invitation"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Loading...</h1>
            <p className="mt-2 text-gray-600">Please wait while we load your invitation.</p>
          </div>
        </div>
      }
    >
      <AcceptInvitationContent />
    </Suspense>
  );
}


