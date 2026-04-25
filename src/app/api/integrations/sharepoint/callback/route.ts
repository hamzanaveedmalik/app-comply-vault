/**
 * GET /api/integrations/sharepoint/callback
 */

import { requireAppAccess } from "~/server/auth/guards";
import { sharepointAdapter } from "~/server/integrations/adapters/sharepoint";
import { NextRequest, NextResponse } from "next/server";

const STATE_COOKIE = "sharepoint_oauth_state";

export async function GET(request: NextRequest): Promise<Response> {
  const access = await requireAppAccess();
  if (!access.ok) {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl?.origin ?? "http://localhost:3000";
    return NextResponse.redirect(`${base}/integrations?sharepoint_error=unauthorized`);
  }

  const stateCookie = request.cookies.get(STATE_COOKIE)?.value;
  const { searchParams } = request.nextUrl ?? new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const base = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl?.origin ?? "http://localhost:3000";
  const redirectBase = `${base}/integrations`;

  if (error) {
    const desc = searchParams.get("error_description");
    const params = new URLSearchParams({
      sharepoint_error: error,
      sharepoint_error_description: desc ?? error,
    });
    const res = NextResponse.redirect(`${redirectBase}?${params.toString()}`);
    res.cookies.delete(STATE_COOKIE);
    return res;
  }

  if (!code || !state || state !== stateCookie) {
    const res = NextResponse.redirect(`${redirectBase}?sharepoint_error=invalid_callback`);
    res.cookies.delete(STATE_COOKIE);
    return res;
  }

  const redirectUri = `${base}/api/integrations/sharepoint/callback`;
  const result = await sharepointAdapter.connect({
    workspaceId: access.workspaceId,
    userId: access.session.user.id,
    authCode: code,
    redirectUri,
  });

  const res = NextResponse.redirect(redirectBase);
  res.cookies.delete(STATE_COOKIE);

  if (!result.success) {
    const params = new URLSearchParams({
      sharepoint_error: "connection_failed",
      sharepoint_error_description: result.error ?? "Connection failed",
    });
    return NextResponse.redirect(`${redirectBase}?${params.toString()}`);
  }

  const params = new URLSearchParams({
    sharepoint_connected: "1",
    sharepoint_email: encodeURIComponent(result.accountDisplayName ?? "SharePoint"),
  });
  return NextResponse.redirect(`${redirectBase}?${params.toString()}`);
}
