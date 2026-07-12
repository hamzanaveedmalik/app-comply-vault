/**
 * GET /api/integrations/m365-mail/admin-consent/callback
 */

import { requireAppAccess } from "~/server/auth/guards";
import {
  acquireApplicationToken,
  storeWorkspaceM365Credential,
} from "~/server/mailbox/m365-auth";
import { ADMIN_STATE_COOKIE } from "../route";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const access = await requireAppAccess();
  const base = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
  const redirectBase = `${base}/integrations/m365-mail`;

  if (!access.ok) {
    return NextResponse.redirect(`${redirectBase}?error=unauthorized`);
  }

  const stateCookie = request.cookies.get(ADMIN_STATE_COOKIE)?.value;
  const { searchParams } = request.nextUrl;
  const state = searchParams.get("state");
  const tenant = searchParams.get("tenant");
  const error = searchParams.get("error");

  if (error) {
    const res = NextResponse.redirect(
      `${redirectBase}?error=${encodeURIComponent(error)}`
    );
    res.cookies.delete(ADMIN_STATE_COOKIE);
    return res;
  }

  if (!state || state !== stateCookie || !tenant) {
    const res = NextResponse.redirect(`${redirectBase}?error=invalid_admin_callback`);
    res.cookies.delete(ADMIN_STATE_COOKIE);
    return res;
  }

  try {
    const tokens = await acquireApplicationToken(tenant);
    await storeWorkspaceM365Credential({
      workspaceId: access.workspaceId,
      accessToken: tokens.accessToken,
      expiresAt: tokens.expiresAt,
      scopes: "https://graph.microsoft.com/.default",
      tenantId: tenant,
    });

    const res = NextResponse.redirect(
      `${redirectBase}?admin_consent=1&tenant=${encodeURIComponent(tenant)}`
    );
    res.cookies.delete(ADMIN_STATE_COOKIE);
    return res;
  } catch {
    const res = NextResponse.redirect(`${redirectBase}?error=admin_consent_failed`);
    res.cookies.delete(ADMIN_STATE_COOKIE);
    return res;
  }
}
