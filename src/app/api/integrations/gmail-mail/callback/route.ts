/**
 * GET /api/integrations/gmail-mail/callback — delegated Google OAuth callback
 */

import { requireAppAccess } from "~/server/auth/guards";
import { db } from "~/server/db";
import {
  exchangeGmailCode,
  storeWorkspaceGmailCredential,
  encodeConnectionToken,
} from "~/server/mailbox/gmail-auth";
import { STATE_COOKIE } from "../connect/route";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const access = await requireAppAccess();
  const base = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
  const redirectBase = `${base}/integrations/gmail-mail`;

  if (!access.ok) {
    return NextResponse.redirect(`${redirectBase}?error=unauthorized`);
  }

  const stateCookie = request.cookies.get(STATE_COOKIE)?.value;
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    const res = NextResponse.redirect(
      `${redirectBase}?error=${encodeURIComponent(error)}`
    );
    res.cookies.delete(STATE_COOKIE);
    return res;
  }

  if (!code || !state || state !== stateCookie) {
    const res = NextResponse.redirect(`${redirectBase}?error=invalid_callback`);
    res.cookies.delete(STATE_COOKIE);
    return res;
  }

  try {
    const tokens = await exchangeGmailCode(code);

    await storeWorkspaceGmailCredential({
      workspaceId: access.workspaceId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      scopes: "gmail.readonly",
    });

    const encryptedToken = encodeConnectionToken({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken ?? null,
      expiresAt: tokens.expiresAt?.toISOString() ?? null,
    });

    const connection = await db.mailboxConnection.upsert({
      where: {
        workspaceId_mailboxAddress: {
          workspaceId: access.workspaceId,
          mailboxAddress: tokens.email,
        },
      },
      create: {
        workspaceId: access.workspaceId,
        provider: "GMAIL",
        mailboxAddress: tokens.email,
        consentMode: "DELEGATED",
        encryptedToken,
        status: "PENDING",
        scopeFolders: [],
      },
      update: {
        provider: "GMAIL",
        consentMode: "DELEGATED",
        encryptedToken,
        status: "PENDING",
        deletedAt: null,
        lastErrorMessage: null,
      },
    });

    await db.auditEvent.create({
      data: {
        workspaceId: access.workspaceId,
        userId: access.session.user.id,
        action: "MAILBOX_CONNECTED",
        resourceType: "mailbox_connection",
        resourceId: connection.id,
        metadata: { provider: "GMAIL", consentMode: "DELEGATED" },
      },
    });

    const res = NextResponse.redirect(
      `${redirectBase}?connected=1&mailbox=${encodeURIComponent(tokens.email)}`
    );
    res.cookies.delete(STATE_COOKIE);
    return res;
  } catch {
    const res = NextResponse.redirect(`${redirectBase}?error=connection_failed`);
    res.cookies.delete(STATE_COOKIE);
    return res;
  }
}
