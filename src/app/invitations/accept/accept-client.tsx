"use client";

import { useCallback, useEffect, useState } from "react";
import { signIn, signOut } from "next-auth/react";
import { ConfirmScreen } from "./components/confirm-screen";
import { ErrorScreen } from "./components/error-screen";
import { LoadingScreen } from "./components/loading-screen";
import { SignInScreen } from "./components/sign-in-screen";
import { SuccessScreen } from "./components/success-screen";
import {
  ACCEPT_PAGE_COLORS,
  ACCEPT_PAGE_FONT,
  type AcceptErrorType,
  type AcceptScreenState,
  type InvitationDetails,
} from "./types";

type VerifyResponse =
  | (InvitationDetails & { valid: true })
  | { valid: false; errorType: AcceptErrorType; message: string };

export default function AcceptInvitationClient({
  token,
  signedInEmail,
}: {
  token?: string;
  signedInEmail: string | null;
}): React.ReactElement {
  const [screen, setScreen] = useState<AcceptScreenState>("loading");
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [errorType, setErrorType] = useState<AcceptErrorType>("invalid");

  const acceptUrl =
    typeof window !== "undefined" && token
      ? `${window.location.origin}/invitations/accept?token=${token}`
      : token
        ? `/invitations/accept?token=${token}`
        : "/invitations/accept";

  const verifyInvitation = useCallback(async (): Promise<void> => {
    if (!token) {
      setErrorType("invalid");
      setScreen("error");
      return;
    }

    setScreen("loading");

    try {
      const response = await fetch(`/api/invitations/verify?token=${encodeURIComponent(token)}`);
      const data = (await response.json()) as VerifyResponse;

      if (!data.valid) {
        setErrorType(data.errorType);
        setScreen("error");
        return;
      }

      const details: InvitationDetails = {
        workspaceName: data.workspaceName,
        role: data.role,
        invitedEmail: data.invitedEmail,
        inviterName: data.inviterName,
        inviterRole: data.inviterRole,
        firmCRD: data.firmCRD,
      };
      setInvitation(details);

      if (!signedInEmail) {
        setScreen("sign-in");
        return;
      }

      if (signedInEmail.toLowerCase() !== details.invitedEmail.toLowerCase()) {
        setErrorType("mismatch");
        setScreen("error");
        return;
      }

      setScreen("confirm");
    } catch {
      setErrorType("error");
      setScreen("error");
    }
  }, [token, signedInEmail]);

  useEffect(() => {
    void verifyInvitation();
  }, [verifyInvitation]);

  const handleSignIn = useCallback(async (): Promise<void> => {
    await signIn("google", { callbackUrl: acceptUrl });
  }, [acceptUrl]);

  const handleSwitchAccount = useCallback(async (): Promise<void> => {
    await signOut({ callbackUrl: acceptUrl });
  }, [acceptUrl]);

  const handleAccept = useCallback(async (): Promise<void> => {
    if (!token) {
      return;
    }

    setScreen("accepting");

    try {
      const response = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string; requiresAuth?: boolean };
        if (response.status === 401 && data.requiresAuth) {
          await handleSignIn();
          return;
        }
        setErrorType("error");
        setScreen("error");
        return;
      }

      setScreen("success");
      window.setTimeout(() => {
        window.location.href = "/dashboard";
      }, 2000);
    } catch {
      setErrorType("error");
      setScreen("error");
    }
  }, [token, handleSignIn]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: ACCEPT_PAGE_COLORS.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        fontFamily: ACCEPT_PAGE_FONT,
      }}
    >
      <div style={{ width: "100%", maxWidth: 420, marginBottom: 24, textAlign: "center" }}>
        <div
          style={{
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            color: ACCEPT_PAGE_COLORS.brand,
          }}
        >
          ComplyVault
        </div>
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: ACCEPT_PAGE_COLORS.surface,
          border: `1px solid ${ACCEPT_PAGE_COLORS.border}`,
          borderRadius: 12,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          padding: 24,
        }}
      >
        {screen === "loading" ? <LoadingScreen /> : null}

        {screen === "accepting" && invitation && signedInEmail ? (
          <ConfirmScreen
            invitation={invitation}
            signedInEmail={signedInEmail}
            isAccepting
            onAccept={() => undefined}
            onSwitchAccount={() => undefined}
          />
        ) : null}

        {screen === "sign-in" && invitation ? (
          <SignInScreen
            invitation={invitation}
            acceptUrl={acceptUrl}
            onSignIn={() => void handleSignIn()}
          />
        ) : null}

        {screen === "confirm" && invitation && signedInEmail ? (
          <ConfirmScreen
            invitation={invitation}
            signedInEmail={signedInEmail}
            isAccepting={false}
            onAccept={() => void handleAccept()}
            onSwitchAccount={() => void handleSwitchAccount()}
          />
        ) : null}

        {screen === "success" && invitation ? (
          <SuccessScreen workspaceName={invitation.workspaceName} role={invitation.role} />
        ) : null}

        {screen === "error" ? (
          <ErrorScreen
            errorType={errorType}
            currentEmail={signedInEmail ?? undefined}
            invitedEmail={invitation?.invitedEmail}
            onSwitchAccount={() => void handleSwitchAccount()}
          />
        ) : null}
      </div>

      <p
        style={{
          marginTop: 24,
          fontSize: 12,
          color: ACCEPT_PAGE_COLORS.textTertiary,
          textAlign: "center",
        }}
      >
        SEC-compliant meeting documentation for RIA firms
      </p>
    </div>
  );
}
