/**
 * GET /api/integrations/zoho-crm/callback
 */

import { requireAppAccess } from "~/server/auth/guards";
import { zohoCrmAdapter } from "~/server/integrations/adapters/zoho-crm";
import { NextRequest, NextResponse } from "next/server";

const STATE_COOKIE = "zoho_crm_oauth_state";

export async function GET(request: NextRequest): Promise<Response> {
  const access = await requireAppAccess();
  const base = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl?.origin ?? "http://localhost:3000";
  const redirectBase = `${base}/integrations`;

  if (!access.ok) {
    return NextResponse.redirect(`${redirectBase}?zoho_crm_error=unauthorized`);
  }

  const stateCookie = request.cookies.get(STATE_COOKIE)?.value;
  const { searchParams } = request.nextUrl ?? new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    const desc = searchParams.get("error_description");
    const params = new URLSearchParams({
      zoho_crm_error: error,
      zoho_crm_error_description: desc ?? error,
    });
    const res = NextResponse.redirect(`${redirectBase}?${params.toString()}`);
    res.cookies.delete(STATE_COOKIE);
    return res;
  }

  if (!code || !state || state !== stateCookie) {
    const res = NextResponse.redirect(`${redirectBase}?zoho_crm_error=invalid_callback`);
    res.cookies.delete(STATE_COOKIE);
    return res;
  }

  const redirectUri = `${base}/api/integrations/zoho-crm/callback`;
  const result = await zohoCrmAdapter.connect({
    workspaceId: access.workspaceId,
    userId: access.session.user.id,
    authCode: code,
    redirectUri,
  });

  const res = NextResponse.redirect(redirectBase);
  res.cookies.delete(STATE_COOKIE);

  if (!result.success) {
    const params = new URLSearchParams({
      zoho_crm_error: "connection_failed",
      zoho_crm_error_description: result.error ?? "Connection failed",
    });
    return NextResponse.redirect(`${redirectBase}?${params.toString()}`);
  }

  const params = new URLSearchParams({
    zoho_crm_connected: "1",
    zoho_crm_account: encodeURIComponent(result.accountDisplayName ?? "Zoho CRM"),
  });
  return NextResponse.redirect(`${redirectBase}?${params.toString()}`);
}
