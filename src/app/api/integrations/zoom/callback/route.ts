/**
 * GET /api/integrations/zoom/callback
 * Epic 1 Story 1.1: Zoom OAuth callback — exchange code, store tokens, redirect to integrations
 */

import { requireAppAccess } from "~/server/auth/guards";
import { zoomAdapter } from "~/server/integrations/adapters/zoom";
import { NextRequest, NextResponse } from "next/server";

const STATE_COOKIE = "zoom_oauth_state";

export async function GET(request: NextRequest) {
  const access = await requireAppAccess();
  if (!access.ok) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
    return NextResponse.redirect(new URL("/auth/signin", baseUrl));
  }

  if (access.session.user.role !== "OWNER_CCO") {
    return new NextResponse("Only workspace owners can connect integrations", { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const storedState = request.cookies.get(STATE_COOKIE)?.value;

  const response = NextResponse.redirect(
    new URL("/integrations", process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin)
  );
  response.cookies.delete(STATE_COOKIE);

  if (error) {
    response.nextUrl.searchParams.set("zoom_error", error);
    response.nextUrl.searchParams.set("zoom_error_description", searchParams.get("error_description") ?? "");
    return response;
  }

  if (!code || !state || state !== storedState) {
    response.nextUrl.searchParams.set("zoom_error", "invalid_callback");
    return response;
  }

  const redirectUri = `${(process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin).replace(/\/$/, "")}/api/integrations/zoom/callback`;

  try {
    const result = await zoomAdapter.connect({
      workspaceId: access.workspaceId,
      userId: access.session.user.id,
      authCode: code,
      redirectUri,
    });

    if (!result.success) {
      response.nextUrl.searchParams.set("zoom_error", result.error ?? "connection_failed");
      return response;
    }

    response.nextUrl.searchParams.set("zoom_connected", "1");
    if (result.accountDisplayName) {
      response.nextUrl.searchParams.set("zoom_email", encodeURIComponent(result.accountDisplayName));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    response.nextUrl.searchParams.set("zoom_error", "connection_failed");
    response.nextUrl.searchParams.set("zoom_error_description", encodeURIComponent(message));
  }

  return response;
}
