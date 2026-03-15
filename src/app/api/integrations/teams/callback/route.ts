/**
 * GET /api/integrations/teams/callback
 * Epic 1 Story 1.4: Teams OAuth callback — exchange code, store tokens, redirect
 */

import { requireAppAccess } from "~/server/auth/guards";
import { teamsAdapter } from "~/server/integrations/adapters/teams";
import { NextRequest, NextResponse } from "next/server";

const STATE_COOKIE = "teams_oauth_state";

export async function GET(request: NextRequest) {
  const access = await requireAppAccess();
  if (!access.ok) {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl?.origin ?? "http://localhost:3000";
    return NextResponse.redirect(
      `${base}/integrations?teams_error=unauthorized`
    );
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
      teams_error: error,
      teams_error_description: desc ?? error,
    });
    const res = NextResponse.redirect(`${redirectBase}?${params.toString()}`);
    res.cookies.delete(STATE_COOKIE);
    return res;
  }

  if (!code || !state || state !== stateCookie) {
    const params = new URLSearchParams({ teams_error: "invalid_callback" });
    const res = NextResponse.redirect(`${redirectBase}?${params.toString()}`);
    res.cookies.delete(STATE_COOKIE);
    return res;
  }

  const redirectUri = `${base}/api/integrations/teams/callback`;
  const result = await teamsAdapter.connect({
    workspaceId: access.workspaceId,
    userId: access.session.user.id,
    authCode: code,
    redirectUri,
  });

  const res = NextResponse.redirect(redirectBase);
  res.cookies.delete(STATE_COOKIE);

  if (!result.success) {
    const params = new URLSearchParams({
      teams_error: "connection_failed",
      teams_error_description: result.error ?? "Connection failed",
    });
    return NextResponse.redirect(`${redirectBase}?${params.toString()}`);
  }

  const params = new URLSearchParams({
    teams_connected: "1",
    teams_email: encodeURIComponent(result.accountDisplayName ?? "Teams account"),
  });
  return NextResponse.redirect(`${redirectBase}?${params.toString()}`);
}
